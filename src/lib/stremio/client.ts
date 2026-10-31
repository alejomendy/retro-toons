import "server-only";
import { unstable_cache } from "next/cache";
import { getTmdbTitle } from "@/lib/tmdb";
import { cachedSeries, catalogMatcher } from "@/lib/lacartoons-schedule";
import { normalize } from "@/lib/text";
import { getAddonCollection, getStremioAddon, STREMIO_ADDONS, type StremioAddonKey } from "./addons";
import type { AddonEpisode, AddonTitle, StremioCatalogResponse, StremioManifest, StremioMetaPreview, StremioMetaResponse, StremioVideo } from "./types";

// Los catálogos de los addons cambian poco: un día de caché, como el de LACartoons.
const CACHE_SECONDS = 24 * 60 * 60;
/** Pedidos a TMDB a la vez al completar nombres. */
const TMDB_CONCURRENCY = 8;

const manifestCache = new Map<string, { expires: number; value: StremioManifest }>();

export async function getAddonManifest(key: StremioAddonKey): Promise<StremioManifest> {
  const addon = STREMIO_ADDONS[key];
  const cached = manifestCache.get(addon.id);
  if (cached && cached.expires > Date.now()) return cached.value;

  const response = await fetch(`${addon.baseUrl}/manifest.json`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${addon.name}: el manifest respondió HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || typeof (data as StremioManifest).id !== "string") {
    throw new Error(`${addon.name}: manifest inválido`);
  }
  const manifest = data as StremioManifest;
  manifestCache.set(addon.id, { expires: Date.now() + 15 * 60_000, value: manifest });
  return manifest;
}

async function addonJson<T>(addonId: string, path: string): Promise<T> {
  const addon = getStremioAddon(addonId);
  if (!addon) throw new Error(`Addon desconocido: ${addonId}`);
  const res = await fetch(`${addon.baseUrl}/${path}`, {
    headers: { Accept: "application/json", "User-Agent": "RetroToons/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${addon.name}: HTTP ${res.status} en ${path}`);
  return (await res.json()) as T;
}

/** Una página (20 títulos) de un catálogo, tal como la manda el addon. */
async function catalogPage(addonId: string, type: string, catalog: string, skip: number): Promise<StremioMetaPreview[]> {
  const extra = skip > 0 ? `/skip=${skip}` : "";
  const data = await addonJson<StremioCatalogResponse>(addonId, `catalog/${type}/${encodeURIComponent(catalog)}${extra}.json`);
  return Array.isArray(data.metas) ? data.metas.filter((m) => m && typeof m.id === "string") : [];
}

/**
 * SCPlus sirve sus pósters a través de su propio servidor con el de TMDB como respaldo (en base64):
 * se usa directo el de TMDB, que es más liviano y ya está habilitado para next/image.
 */
function cleanImage(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const fallback = new URL(url).searchParams.get("fallback");
    if (fallback) {
      const decoded = Buffer.from(fallback, "base64").toString("utf8");
      if (decoded.startsWith("https://image.tmdb.org/")) return decoded.replace("/w185/", "/w342/");
    }
  } catch {
    return null;
  }
  return url;
}

/** Id de TMDB de los formatos de los addons: "tmdb:123" o "tmdb:series:123". */
function tmdbId(id: string): number | null {
  const m = /^tmdb:(?:(?:series|movie):)?(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

type Normalized = AddonTitle & { originalName: string | null };

/**
 * Pasa una ficha del addon al formato de RetroToons. El addon de Cartoon Network viene en inglés
 * (y sin nombre en las series), así que con su id de TMDB se completa en español latino.
 */
async function normalizeMeta(addonId: string, raw: StremioMetaPreview): Promise<Normalized | null> {
  const type = raw.type === "movie" ? "movie" : "series";
  const tmdb = addonId === "cartoon-network" && tmdbId(raw.id) !== null ? await getTmdbTitle(type === "movie" ? "movie" : "tv", tmdbId(raw.id)!) : null;
  const name = tmdb?.name ?? raw.name;
  if (!name) return null;
  const year = raw.releaseInfo ?? (raw.year ? String(raw.year) : null) ?? tmdb?.year ?? null;
  return {
    addon: addonId,
    type,
    id: raw.id,
    name,
    originalName: tmdb?.originalName ?? raw.name ?? null,
    poster: tmdb?.poster ?? cleanImage(raw.poster),
    background: tmdb?.backdrop ?? cleanImage(raw.background),
    year: year ? String(year) : null,
    description: tmdb?.overview ?? raw.description ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres : raw.genres ? raw.genres.split(",").map((g) => g.trim()).filter(Boolean) : [],
    lacartoons: null,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Marca los títulos que también están en LACartoons. Las películas y las sagas de Springfield,
 * solo con nombre exacto: si no, "Ben 10: Alien Swarm" sería la serie de Ben 10.
 */
async function withLacartoons(titles: Normalized[]): Promise<AddonTitle[]> {
  const find = await catalogMatcher();
  return titles.map(({ originalName, ...t }) => {
    const names = [t.name, originalName].filter((n): n is string => !!n);
    const found = find(names, t.type === "movie" || t.addon === "springfield-3000");
    return { ...t, lacartoons: found ? { id: found.id, name: found.name } : null };
  });
}

/** Todos los títulos de una colección, sin repetir, en caché un día. */
export const getCollectionTitles = unstable_cache(
  async (slug: string): Promise<AddonTitle[]> => {
    const collection = getAddonCollection(slug);
    if (!collection) return [];
    const raw: { addon: string; meta: StremioMetaPreview }[] = [];
    let failures = 0;
    for (const source of collection.sources) {
      for (let page = 0; page < source.pages; page++) {
        const metas = await catalogPage(source.addon, source.type, source.catalog, page * 20).catch(() => {
          failures++;
          return [];
        });
        raw.push(...metas.map((meta) => ({ addon: source.addon, meta })));
        if (metas.length < 20) break;
      }
    }
    const seen = new Set<string>();
    const unique = raw.filter(({ meta }) => {
      const key = `${meta.type}:${meta.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const normalized = (await mapLimit(unique, TMDB_CONCURRENCY, ({ addon, meta }) => normalizeMeta(addon, meta))).filter((t): t is Normalized => !!t);
    // Vacío por errores = el addon no respondió: se lanza para que no quede guardado.
    if (normalized.length === 0 && failures > 0) throw new Error(`${collection.title}: los addons no respondieron`);
    return withLacartoons(normalized);
  },
  ["stremio-collection-v1"],
  { revalidate: CACHE_SECONDS },
);

/** Una página de cualquier catálogo de un addon, normalizada (para el explorador de /addons). */
export async function getCatalogTitles(addonId: string, type: string, catalog: string, skip: number): Promise<AddonTitle[]> {
  const metas = await catalogPage(addonId, type, catalog, skip);
  const normalized = (await mapLimit(metas, TMDB_CONCURRENCY, (meta) => normalizeMeta(addonId, meta))).filter((t): t is Normalized => !!t);
  return withLacartoons(normalized);
}

/**
 * Series de IMDb (ids de episodio "tt…:temporada:episodio" de Springfield 3000) que están en LACartoons.
 * Los Simpson tienen la misma numeración; Futurama está en orden de producción en una sola
 * temporada, así que sus episodios se buscan por título (en LACartoons están en inglés).
 */
const IMDB_SERIES: Record<string, { names: string[]; sameSeasons: boolean }> = {
  tt0096697: { names: ["Los Simpsons", "Los Simpson", "The Simpsons"], sameSeasons: true },
  tt0149460: { names: ["Futurama"], sameSeasons: false },
};

/** Título del episodio sin el "[S01E04] " que le agrega Springfield 3000. */
function episodeTitle(video: StremioVideo): string {
  return (video.title ?? video.name ?? "").replace(/^\[S\d+E\d+\]\s*/i, "").trim();
}

/** Título para comparar entre fuentes: sin apóstrofos y sin diferencias de ortografía ("Labours"/"Labors", "Slippin’"/"Slipping"). */
function titleKey(title: string): string {
  return normalize(title.replace(/['’]/g, ""))
    .split(" ")
    .map((w) => w.replace(/our/g, "or").replace(/ing$/, "in"))
    .join(" ");
}

/** Episodios de la ficha, cada uno con su equivalente en LACartoons si lo hay. */
async function mapEpisodes(videos: StremioVideo[]): Promise<AddonEpisode[]> {
  const find = await catalogMatcher();
  const lookups = new Map<string, Promise<{ seriesId: string; byNumber: Map<string, string>; byTitle: Map<string, string>; sameSeasons: boolean } | null>>();
  const lookup = (imdb: string) => {
    if (!lookups.has(imdb)) {
      lookups.set(
        imdb,
        (async () => {
          const ref = IMDB_SERIES[imdb];
          const found = ref && find(ref.names, true);
          const series = found ? await cachedSeries(found.id).catch(() => null) : null;
          if (!series) return null;
          return {
            seriesId: series.id,
            byNumber: new Map(series.videos.map((v) => [`${v.season}:${v.episode}`, v.id])),
            byTitle: new Map(series.videos.map((v) => [titleKey(v.title), v.id])),
            sameSeasons: ref.sameSeasons,
          };
        })(),
      );
    }
    return lookups.get(imdb)!;
  };

  return Promise.all(
    videos.map(async (video): Promise<AddonEpisode> => {
      const title = episodeTitle(video);
      const [imdb, season, episode] = video.id.split(":");
      const label = /^\[(S\d+E\d+)\]/i.exec(video.title ?? "")?.[1] ?? null;
      const lc = /^tt\d+$/.test(imdb) && season && episode ? await lookup(imdb) : null;
      const episodeId = lc ? lc.byTitle.get(titleKey(title)) ?? (lc.sameSeasons ? lc.byNumber.get(`${season}:${episode}`) : undefined) : undefined;
      return {
        id: video.id,
        title: title || `Episodio ${video.episode ?? ""}`.trim(),
        label,
        thumbnail: video.thumbnail ?? null,
        overview: video.overview && !/Original episode S\d+E\d+/.test(video.overview) ? video.overview : null,
        watch: lc && episodeId ? { seriesId: lc.seriesId, episodeId } : null,
      };
    }),
  );
}

/** Ficha completa de un título de un addon, con sus episodios. null si el addon no lo tiene. */
export const getAddonTitle = unstable_cache(
  async (addonId: string, type: string, id: string): Promise<{ title: AddonTitle; episodes: AddonEpisode[] } | null> => {
    // El addon de Cartoon Network responde la ficha sin el envoltorio { meta }.
    const data = await addonJson<StremioMetaResponse & StremioMetaPreview>(addonId, `meta/${type}/${encodeURIComponent(id)}.json`);
    const raw = data.meta ?? (typeof data.id === "string" ? data : null);
    if (!raw) return null;
    const normalized = await normalizeMeta(addonId, { ...raw, type: raw.type ?? type });
    if (!normalized) return null;
    const [title] = await withLacartoons([normalized]);
    const videos = (data.meta?.videos ?? []).filter((v) => v && typeof v.id === "string");
    return { title, episodes: await mapEpisodes(videos) };
  },
  ["stremio-title-v2"],
  { revalidate: CACHE_SECONDS },
);
