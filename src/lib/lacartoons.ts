import "server-only";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import {
  isValidEpisodeId,
  isValidSeriesId,
  lcErrorMessages,
  type LcApiError,
  type LcEpisode,
  type LcErrorCode,
  type LcSeries,
  type LcSeriesSummary,
  type LcStream,
  type LcStreamKind,
} from "./lacartoons-types";

/**
 * Cliente del addon de Stremio LACartoons (protocolo de addons de Stremio).
 * Todo lo que llega del addon se valida acá antes de usarse.
 */

const ADDON_URL = process.env.LACARTOONS_ADDON_URL ?? "http://127.0.0.1:7000";
const CATALOG_ID = "lacart_catalogo";

export class LcError extends Error {
  constructor(
    public code: LcErrorCode,
    message: string = lcErrorMessages[code],
  ) {
    super(message);
    this.name = "LcError";
  }
}

const statusByCode: Record<LcErrorCode, number> = {
  ADDON_UNREACHABLE: 502,
  ADDON_BAD_RESPONSE: 502,
  MALFORMED_DATA: 502,
  INVALID_ID: 400,
  SERIES_NOT_FOUND: 404,
  NO_EPISODES: 404,
  NO_STREAMS: 404,
};

/** Respuesta JSON de error común a todas las API Routes de series. */
export function lcErrorResponse(error: unknown, context: string): NextResponse<LcApiError> {
  const err = error instanceof LcError ? error : new LcError("ADDON_UNREACHABLE");
  if (!(error instanceof LcError)) console.error(`LACartoons (${context}):`, error);
  return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: statusByCode[err.code] });
}

async function addonGet(path: string, timeoutMs = 15000): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(new URL(path, ADDON_URL), { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error(`LACartoons: tardó más de ${timeoutMs / 1000}s en ${path}`);
      throw new LcError("ADDON_UNREACHABLE", "El catálogo de LACartoons tardó demasiado en responder. Probá de nuevo.");
    }
    console.error(`LACartoons: no responde ${path}`, error);
    throw new LcError("ADDON_UNREACHABLE");
  }
  if (res.status === 404) throw new LcError("SERIES_NOT_FOUND");
  if (!res.ok) throw new LcError("ADDON_BAD_RESPONSE");
  try {
    return await res.json();
  } catch {
    throw new LcError("MALFORMED_DATA");
  }
}

// ── Validación ──────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const httpUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : []);
const int = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
};

function parseSummary(v: unknown): LcSeriesSummary | null {
  if (!isObj(v) || !isValidSeriesId(v.id)) return null;
  const name = str(v.name);
  if (!name) return null;
  return { id: v.id, name, poster: httpUrl(v.poster), genres: strList(v.genres) };
}

function parseEpisode(v: unknown): LcEpisode | null {
  if (!isObj(v) || !isValidEpisodeId(v.id)) return null;
  const season = int(v.season);
  const episode = int(v.episode ?? v.number);
  if (season === null || episode === null) return null;
  return {
    id: v.id,
    title: str(v.title) ?? str(v.name) ?? `Episodio ${episode}`,
    season,
    episode,
    thumbnail: httpUrl(v.thumbnail),
    released: str(v.released),
    overview: str(v.overview) ?? str(v.description),
  };
}

function streamKind(url: string): LcStreamKind {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (path.endsWith(".mpd")) return "dash";
  if (path.endsWith(".webm")) return "webm";
  if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "mp4";
  return "unknown";
}

const mimeByKind: Record<LcStreamKind, string> = {
  hls: "application/x-mpegURL",
  dash: "application/dash+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  // Sin extensión (ej. ok.ru): se asume video progresivo, como hacía el reproductor.
  unknown: "video/mp4",
};

/**
 * Cuando el addon no logra extraer el video de un host (ej. cubeembed), a veces devuelve
 * la primera petición que vio en la página, que es de analítica. Eso no es un video.
 */
const JUNK_HOSTS = /(^|\.)(mc\.yandex\.(ru|com)|google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.com|hotjar\.com)$/i;
function isJunkUrl(url: string): boolean {
  return JUNK_HOSTS.test(new URL(url).hostname);
}

function parseStream(v: unknown, index: number): LcStream | null {
  if (!isObj(v)) return null;
  // Solo URLs http(s): torrents (infoHash) o enlaces externos no se reproducen en el navegador.
  const url = httpUrl(v.url);
  if (!url || isJunkUrl(url)) return null;
  const hints = isObj(v.behaviorHints) ? v.behaviorHints : {};
  const proxy = isObj(hints.proxyHeaders) ? hints.proxyHeaders : null;
  const kind = streamKind(url);
  const label = [str(v.name), str(v.title)?.replace(/\s+/g, " ")].filter(Boolean).join(" · ") || `Fuente ${index + 1}`;
  return {
    url,
    label,
    kind,
    mimeType: mimeByKind[kind],
    notWebReady: hints.notWebReady === true,
    requiresHeaders: !!proxy && isObj(proxy.request) && Object.keys(proxy.request).length > 0,
  };
}

// ── Consultas ───────────────────────────────────────────────────────────────

export interface CatalogQuery {
  search?: string;
  genre?: string;
  skip?: number;
}

/** Catálogo / búsqueda. Los extras van en el path, como define el protocolo de Stremio. */
export async function fetchCatalog({ search, genre, skip }: CatalogQuery): Promise<LcSeriesSummary[]> {
  const extras: string[] = [];
  if (search) extras.push(`search=${encodeURIComponent(search)}`);
  if (genre) extras.push(`genre=${encodeURIComponent(genre)}`);
  if (skip && skip > 0) extras.push(`skip=${Math.floor(skip)}`);
  const path = `/catalog/series/${CATALOG_ID}${extras.length ? `/${extras.join("&")}` : ""}.json`;

  const data = await addonGet(path);
  if (!isObj(data) || !Array.isArray(data.metas)) throw new LcError("MALFORMED_DATA");
  const seen = new Set<string>();
  const results = data.metas
    .map(parseSummary)
    .filter((s): s is LcSeriesSummary => !!s && !seen.has(s.id) && !!seen.add(s.id));
  // Con búsqueda el addon ignora la cadena: se filtra con los géneros que trae cada resultado.
  return search && genre ? results.filter((s) => s.genres.includes(genre)) : results;
}

export async function fetchSeries(id: string): Promise<LcSeries> {
  if (!isValidSeriesId(id)) throw new LcError("INVALID_ID");
  const data = await addonGet(`/meta/series/${encodeURIComponent(id)}.json`);
  const meta = isObj(data) && isObj(data.meta) ? data.meta : null;
  if (!meta) throw new LcError("SERIES_NOT_FOUND");

  const summary = parseSummary(meta);
  if (!summary) throw new LcError("MALFORMED_DATA");

  const rawVideos = Array.isArray(meta.videos) ? meta.videos : [];
  const videos = rawVideos.map(parseEpisode).filter((e): e is LcEpisode => !!e);

  // Para IDs inexistentes el addon devuelve un "Próximamente" genérico sin póster ni episodios.
  if (rawVideos.length === 0 && !summary.poster) throw new LcError("SERIES_NOT_FOUND");
  if (rawVideos.length > 0 && videos.length === 0) throw new LcError("MALFORMED_DATA");

  return {
    ...summary,
    background: httpUrl(meta.background),
    description: str(meta.description),
    releaseInfo: str(meta.releaseInfo),
    language: str(meta.language),
    videos,
  };
}

export async function fetchStreams(episodeId: string): Promise<LcStream[]> {
  if (!isValidEpisodeId(episodeId)) throw new LcError("INVALID_ID");
  // El addon busca las fuentes en el momento: con episodios sin video puede tardar más de 20 s.
  const data = await addonGet(`/stream/series/${encodeURIComponent(episodeId)}.json`, 45000);
  if (!isObj(data) || !Array.isArray(data.streams)) throw new LcError("MALFORMED_DATA");
  const streams = data.streams.map(parseStream).filter((s): s is LcStream => !!s);
  // Primero las que el navegador puede reproducir tal cual (ej. el proxy del addon). Las directas de ok.ru
  // piden encabezados y quedan firmadas para la IP del servidor que las pidió: con el addon en la nube suelen fallar.
  const needsHelp = (s: LcStream) => (s.notWebReady || s.requiresHeaders ? 1 : 0);
  return streams.sort((a, b) => needsHelp(a) - needsHelp(b) || qualityRank(a) - qualityRank(b));
}

/**
 * Calidad preferida al arrancar. Por el proxy del addon (plan gratis, ~700-950 KB/s) el primer
 * pedazo de 720p pesa ~5 MB y tarda ~6 s; el de 480p ~2,4 MB y ~3,5 s, y se reproduce sin cortes.
 * En la biblioteca se puede elegir otra calidad desde el selector de fuente.
 */
const QUALITY_ORDER = ["480p", "720p", "360p", "1080p", "240p", "144p"];
function qualityRank(s: LcStream): number {
  const i = QUALITY_ORDER.findIndex((q) => s.label.includes(q));
  return i < 0 ? QUALITY_ORDER.length : i;
}

/** Cadenas/categorías reales que declara el manifiesto del addon. */
export async function fetchGenres(): Promise<string[]> {
  try {
    const data = await addonGet("/manifest.json", 8000);
    if (!isObj(data) || !Array.isArray(data.catalogs)) return [];
    const catalog = data.catalogs.find((c) => isObj(c) && c.id === CATALOG_ID);
    if (!isObj(catalog) || !Array.isArray(catalog.extra)) return [];
    const genre = catalog.extra.find((e) => isObj(e) && e.name === "genre");
    return isObj(genre) ? strList(genre.options) : [];
  } catch {
    return [];
  }
}

/**
 * Fuentes en caché 3 h: las URLs firmadas de ok.ru vencen a las ~24 h, así que es seguro y
 * evita esperar de nuevo al addon (que tarda 5-30 s) al volver a abrir un episodio.
 */
export const fetchStreamsCached = unstable_cache((episodeId: string) => fetchStreams(episodeId), ["lacartoons-streams-v3"], {
  revalidate: 3 * 60 * 60,
});
