import "server-only";

const TORRENTIO_BASE = process.env.TORRENTIO_BASE?.trim() || "https://torrentio.strem.fun";
/**
 * Configuración de Torrentio: todos los proveedores, incluidos los en español (MejorTorrent, Wolfmax4k,
 * Cinecalidad, BestTorrents), y prioridad a latino/español. Sin esto se consultaba la configuración por
 * defecto y se perdían torrents en español (ej. Coraje, Samurai Jack). Se puede cambiar con TORRENTIO_OPTIONS.
 */
const TORRENTIO_OPTIONS =
  process.env.TORRENTIO_OPTIONS?.trim() ||
  "providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,rutor,rutracker,comando,bludv,torrent9,ilcorsaronero,mejortorrent,wolfmax4k,cinecalidad,besttorrents|language=latino,spanish";
const TORRENTIO = `${TORRENTIO_BASE}/${TORRENTIO_OPTIONS}`;
const CACHE_MS = 60 * 60 * 1000;

export type AudioLanguage = "latino" | "dual-latino" | "castellano" | "sub-es" | "other";

export interface TorrentStream {
  infoHash: string;
  fileIdx: number;
  title: string;
  resolution: string;
  size: string;
  seeders: number;
  language: AudioLanguage;
  isLatino: boolean;
  hasSpanishSubs: boolean;
  tagLabel: string;
  rawTitle: string;
}

interface RawTorrentioStream {
  name?: string;
  title?: string;
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: { filename?: string };
}

/**
 * El navegador no decodifica HEVC/x265 ni video de 10 bits, y AVI/WMV no los abre: esos torrents
 * daban "MEDIA_ERR_SRC_NOT_SUPPORTED" y rompían el reproductor. Se descartan.
 */
const UNPLAYABLE_VIDEO = /\b(x\.?265|h\.?265|hevc|10[ -]?bits?|av1)\b|\.(avi|wmv|flv|ts|m2ts)$/i;
/** Audio AC3/EAC3/DTS: Chrome no lo reproduce (video mudo o error). Se dejan como última opción. */
const BAD_AUDIO = /\b(e?ac-?3|ddp?\s?[257]\.?[01]?|dd\+|dts(-?hd)?|truehd|atmos)\b/i;

interface RawTorrentioResponse {
  streams?: RawTorrentioStream[];
}

const cache = new Map<string, { streams: TorrentStream[]; at: number }>();

function parseStream(raw: RawTorrentioStream): TorrentStream | null {
  if (!raw.infoHash) return null;

  const titleText = raw.title || "";
  const nameText = raw.name || "";
  const combined = `${nameText}\n${titleText}`;
  const filename = raw.behaviorHints?.filename ?? "";
  // El nombre del archivo va último: así la extensión queda al final del texto que se revisa.
  if (UNPLAYABLE_VIDEO.test(`${combined}\n${filename}`)) return null;

  // Semillas: 👤 37
  const seedMatch = combined.match(/👤\s*(\d+)/);
  const seeders = seedMatch ? Number.parseInt(seedMatch[1], 10) : 0;

  // Tamaño: 💾 1.33 GB
  const sizeMatch = combined.match(/💾\s*([0-9.]+\s*[MGK]B)/i);
  const size = sizeMatch ? sizeMatch[1].trim() : "";

  // Resolución
  const resMatch = combined.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
  const resolution = resMatch ? resMatch[1].toUpperCase() : "720P";

  // Detección precisa de idioma
  const hasLatino =
    /\b(latino|latam|latin|audio latino|doblaje latino|dvdrip latino|\blat\b)\b/i.test(combined) ||
    combined.includes("🇲🇽") ||
    combined.includes("Latin America");

  const hasDualOrMulti = /\b(dual|multi|audio dual|multi-audio|multiaudio)\b/i.test(combined);

  const hasCastellano =
    /\b(castellano|español|espanol|spanish|\bspa\b|esp)\b/i.test(combined) ||
    combined.includes("🇪🇸");

  const hasSpanishSubs =
    /(\bsub|\bsubs|subtitulad[oa]|subbed|softsubs?)\b/i.test(combined) &&
    /(\bes\b|\besp\b|\bspa\b|spanish|español|latino)/i.test(combined) ||
    /\[(?:sub-?esp|esp|sub español|sub-es)\]/i.test(combined) ||
    /\b(erai-raws|puyasubs|animemf|animeteam|nanikano|kagura|yousei)\b/i.test(combined);

  let language: AudioLanguage = "other";
  let tagLabel = "";

  if (hasLatino && hasDualOrMulti) {
    language = "dual-latino";
    tagLabel = "🇲🇽 Dual Latino";
  } else if (hasLatino) {
    language = "latino";
    tagLabel = "🇲🇽 Latino";
  } else if (hasSpanishSubs) {
    language = "sub-es";
    tagLabel = "💬 Subs Español";
  } else if (hasCastellano) {
    language = "castellano";
    tagLabel = "🇪🇸 Español";
  } else if (hasDualOrMulti) {
    language = "dual-latino";
    tagLabel = "🌐 Multi Audio";
  }

  // Título amigable del archivo
  const lines = titleText.split("\n").map((l) => l.trim()).filter(Boolean);
  const cleanTitle = lines[1] || lines[0] || "Episodio";

  return {
    infoHash: raw.infoHash.toLowerCase(),
    fileIdx: typeof raw.fileIdx === "number" ? raw.fileIdx : 0,
    title: cleanTitle,
    resolution,
    size,
    seeders,
    language,
    isLatino: language === "latino" || language === "dual-latino",
    hasSpanishSubs: language === "sub-es",
    tagLabel,
    rawTitle: `${combined}\n${filename}`,
  };
}

/** Los de audio que el navegador no reproduce van al final (dentro del mismo idioma). */
export const badAudio = (s: TorrentStream) => (BAD_AUDIO.test(s.rawTitle) ? 1 : 0);

export interface StreamOptions {
  isAnime?: boolean;
}

/**
 * Consulta Torrentio por torrents de un episodio dado el IMDb ID de la serie.
 * - Para Cartoons/Retro: asegura audio latino o español y descarta streams en inglés/otros idiomas.
 * - Para Anime: acepta tanto audio latino como subtítulos en español (priorizando latino).
 */
export async function getTorrentStreams(
  imdbId: string,
  season: number,
  episode: number,
  options?: StreamOptions,
): Promise<TorrentStream[]> {
  const isAnime = !!options?.isAnime;
  const key = `series:${imdbId}:${season}:${episode}:${isAnime ? "anime" : "cartoon"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.streams;

  const url = `${TORRENTIO}/stream/series/${encodeURIComponent(imdbId)}:${season}:${episode}.json`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
      // Sin la caché de fetch de Next: podía guardar respuestas fallidas. Este módulo ya guarda 1 h las buenas.
      cache: "no-store",
    });
    if (!res.ok) {
      // Solo un 404 es "no hay torrents". Un 429 (demasiados pedidos) o un 5xx son pasajeros: guardarlos
      // dejaba el episodio una hora como sin torrents aunque los tuviera.
      if (res.status === 404) cache.set(key, { streams: [], at: Date.now() });
      else console.warn(`[torrentio] ${res.status} en ${url}`);
      return [];
    }

    const data = (await res.json()) as RawTorrentioResponse;
    if (!Array.isArray(data.streams)) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    let parsed = data.streams
      .map(parseStream)
      // Sin seeds el torrent nunca arranca (la tele esperaba 25 s para nada).
      .filter((s): s is TorrentStream => s !== null && s.seeders >= 1);

    // Filtro estricto según preferencia del usuario
    if (isAnime) {
      // Para anime: se acepta audio latino, multi, subtítulos en español o castellano
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "sub-es" || s.language === "castellano",
      );
    } else {
      // Para cartoons / series retro: estrictamente en audio latino / español
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "castellano",
      );
    }

    // Orden de preferencia:
    // 1. Latino
    // 2. Dual Latino
    // 3. Subs Español (en anime)
    // 4. Castellano
    // Luego por cantidad de semillas
    const priority = (s: TorrentStream): number => {
      if (s.language === "latino") return 4;
      if (s.language === "dual-latino") return 3;
      if (s.language === "sub-es") return 2;
      if (s.language === "castellano") return 1;
      return 0;
    };

    parsed.sort((a, b) => {
      const diff = priority(b) - priority(a);
      if (diff !== 0) return diff;
      return badAudio(a) - badAudio(b) || b.seeders - a.seeders;
    });

    cache.set(key, { streams: parsed, at: Date.now() });
    return parsed;
  } catch (err) {
    console.warn(`[torrentio] Error al consultar ${url}:`, err);
    return [];
  }
}

/**
 * Consulta Torrentio para una película dado su IMDb ID en español latino/subtitulado.
 */
export async function getMovieTorrentStreams(imdbId: string, options?: StreamOptions): Promise<TorrentStream[]> {
  const isAnime = !!options?.isAnime;
  const key = `movie:${imdbId}:${isAnime ? "anime" : "regular"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.streams;

  const url = `${TORRENTIO}/stream/movie/${encodeURIComponent(imdbId)}.json`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
      // Sin la caché de fetch de Next: podía guardar respuestas fallidas. Este módulo ya guarda 1 h las buenas.
      cache: "no-store",
    });
    if (!res.ok) {
      // Solo un 404 es "no hay torrents". Un 429 (demasiados pedidos) o un 5xx son pasajeros: guardarlos
      // dejaba el episodio una hora como sin torrents aunque los tuviera.
      if (res.status === 404) cache.set(key, { streams: [], at: Date.now() });
      else console.warn(`[torrentio] ${res.status} en ${url}`);
      return [];
    }

    const data = (await res.json()) as RawTorrentioResponse;
    if (!Array.isArray(data.streams)) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    let parsed = data.streams
      .map(parseStream)
      .filter((s): s is TorrentStream => s !== null);

    if (isAnime) {
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "sub-es" || s.language === "castellano",
      );
    } else {
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "castellano",
      );
    }

    const priority = (s: TorrentStream): number => {
      if (s.language === "latino") return 4;
      if (s.language === "dual-latino") return 3;
      if (s.language === "sub-es") return 2;
      if (s.language === "castellano") return 1;
      return 0;
    };

    parsed.sort((a, b) => {
      const diff = priority(b) - priority(a);
      if (diff !== 0) return diff;
      return badAudio(a) - badAudio(b) || b.seeders - a.seeders;
    });

    cache.set(key, { streams: parsed, at: Date.now() });
    return parsed;
  } catch (err) {
    console.warn(`[torrentio] Error al consultar película ${url}:`, err);
    return [];
  }
}
