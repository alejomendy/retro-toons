import "server-only";

/**
 * Cliente de TMDB (https://developer.themoviedb.org) — datos en español latino.
 *
 * Variables de entorno (alcanza con una):
 *   TMDB_API_KEY     — "API Key" (v3)
 *   TMDB_READ_TOKEN  — "API Read Access Token" (v4, Bearer)
 *   TMDB_REGION      — país para "dónde ver" (por defecto AR)
 *
 * Gratis para proyectos no comerciales; hay que mostrar la atribución a TMDB.
 */
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const LANG = "es-MX";
const ONE_DAY = 60 * 60 * 24;

export function tmdbEnabled(): boolean {
  return !!(process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN);
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!tmdbEnabled()) return null;
  const search = new URLSearchParams(params);
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env.TMDB_READ_TOKEN) headers.Authorization = `Bearer ${process.env.TMDB_READ_TOKEN}`;
  else search.set("api_key", process.env.TMDB_API_KEY!);

  try {
    const res = await fetch(`${BASE}${path}?${search}`, {
      headers,
      next: { revalidate: ONE_DAY },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn(`[tmdb] ${res.status} en ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface TmdbProvider {
  name: string;
  logo: string;
}

export interface TmdbShow {
  id: number;
  name: string;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  seasons: { number: number; episodeCount: number }[];
  /** Claves de YouTube de openings/trailers, primero los que están en español. */
  videos: { key: string; name: string; type: string }[];
  providers: TmdbProvider[];
  providersLink: string | null;
}

export interface TmdbEpisode {
  season: number;
  number: number;
  name: string;
  overview: string | null;
  still: string | null;
}

interface RawTv {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  seasons: { season_number: number; episode_count: number }[];
  videos?: { results: { key: string; name: string; site: string; type: string; iso_639_1: string }[] };
  "watch/providers"?: { results: Record<string, { link: string; flatrate?: { provider_name: string; logo_path: string }[] }> };
}

/** Busca la serie en TMDB por título original y año de estreno. */
export async function findTmdb(originalTitle: string, year: number): Promise<{ id: number; poster: string | null } | null> {
  type Res = { results: { id: number; poster_path: string | null }[] };
  const withYear = await tmdb<Res>("/search/tv", { query: originalTitle, first_air_date_year: String(year), language: LANG });
  const hit = withYear?.results[0] ?? (await tmdb<Res>("/search/tv", { query: originalTitle, language: LANG }))?.results[0];
  return hit ? { id: hit.id, poster: hit.poster_path ? `${IMG}/w342${hit.poster_path}` : null } : null;
}

export async function findTmdbId(originalTitle: string, year: number): Promise<number | null> {
  return (await findTmdb(originalTitle, year))?.id ?? null;
}

export async function getTmdbShow(id: number): Promise<TmdbShow | null> {
  const raw = await tmdb<RawTv>(`/tv/${id}`, {
    language: LANG,
    append_to_response: "videos,watch/providers",
    include_video_language: "es,en,null",
  });
  if (!raw) return null;

  const region = process.env.TMDB_REGION || "AR";
  const watch = raw["watch/providers"]?.results[region];
  const videos = (raw.videos?.results ?? [])
    .filter((v) => v.site === "YouTube")
    .sort((a, b) => Number(b.iso_639_1 === "es") - Number(a.iso_639_1 === "es"))
    .map((v) => ({ key: v.key, name: v.name, type: v.type }));

  return {
    id: raw.id,
    name: raw.name,
    overview: raw.overview || null,
    poster: raw.poster_path ? `${IMG}/w342${raw.poster_path}` : null,
    backdrop: raw.backdrop_path ? `${IMG}/w1280${raw.backdrop_path}` : null,
    seasons: raw.seasons.filter((s) => s.season_number > 0).map((s) => ({ number: s.season_number, episodeCount: s.episode_count })),
    videos,
    providers: (watch?.flatrate ?? []).map((p) => ({ name: p.provider_name, logo: `${IMG}/w92${p.logo_path}` })),
    providersLink: watch?.link ?? null,
  };
}

export async function getTmdbSeason(id: number, season: number): Promise<TmdbEpisode[]> {
  type Raw = { episodes: { season_number: number; episode_number: number; name: string; overview: string; still_path: string | null }[] };
  const raw = await tmdb<Raw>(`/tv/${id}/season/${season}`, { language: LANG });
  return (raw?.episodes ?? []).map((e) => ({
    season: e.season_number,
    number: e.episode_number,
    name: e.name,
    overview: e.overview || null,
    still: e.still_path ? `${IMG}/w300${e.still_path}` : null,
  }));
}
