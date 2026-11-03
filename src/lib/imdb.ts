import "server-only";

const BASE = "https://api.themoviedb.org/3";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const imdbCache = new Map<number, { id: string | null; at: number }>();
const nameCache = new Map<string, { id: string | null; at: number }>();

function getTmdbHeaders(): { headers: HeadersInit; search: URLSearchParams } {
  const search = new URLSearchParams();
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env.TMDB_READ_TOKEN) {
    headers.Authorization = `Bearer ${process.env.TMDB_READ_TOKEN}`;
  } else if (process.env.TMDB_API_KEY) {
    search.set("api_key", process.env.TMDB_API_KEY);
  }
  return { headers, search };
}

/** Obtiene el IMDb ID de una serie o película desde TMDB dado su tmdbId. */
export async function getImdbIdFromTmdb(tmdbId: number, isMovie = false): Promise<string | null> {
  const cached = imdbCache.get(tmdbId);
  if (cached && Date.now() - cached.at < ONE_DAY_MS) return cached.id;

  const { headers, search } = getTmdbHeaders();
  const endpoint = isMovie ? `/movie/${tmdbId}/external_ids` : `/tv/${tmdbId}/external_ids`;

  try {
    const res = await fetch(`${BASE}${endpoint}?${search}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      imdbCache.set(tmdbId, { id: null, at: Date.now() });
      return null;
    }
    const data = (await res.json()) as { imdb_id?: string | null };
    const imdbId = data.imdb_id?.trim() || null;
    imdbCache.set(tmdbId, { id: imdbId, at: Date.now() });
    return imdbId;
  } catch (err) {
    console.warn(`[imdb] Error al buscar IMDb ID para TMDB ${tmdbId}:`, err);
    return null;
  }
}

/** Busca una serie por título en TMDB y obtiene su IMDb ID. */
export async function findImdbId(title: string, year?: number | null): Promise<string | null> {
  const key = `${title}:${year ?? ""}`.toLowerCase();
  const cached = nameCache.get(key);
  if (cached && Date.now() - cached.at < ONE_DAY_MS) return cached.id;

  const { headers, search } = getTmdbHeaders();
  search.set("query", title);
  if (year) search.set("first_air_date_year", String(year));

  try {
    const res = await fetch(`${BASE}/search/tv?${search}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      nameCache.set(key, { id: null, at: Date.now() });
      return null;
    }
    const data = (await res.json()) as { results?: { id: number }[] };
    const first = data.results?.[0];
    if (!first?.id) {
      nameCache.set(key, { id: null, at: Date.now() });
      return null;
    }
    const imdbId = await getImdbIdFromTmdb(first.id, false);
    nameCache.set(key, { id: imdbId, at: Date.now() });
    return imdbId;
  } catch (err) {
    console.warn(`[imdb] Error al buscar serie "${title}":`, err);
    return null;
  }
}


const seasonCache = new Map<string, { counts: Map<number, number> | null; at: number }>();

/**
 * Episodios de cada temporada (sin la 0 de especiales) de una serie, por su IMDb ID. Sirve para pasar a
 * temporada y episodio los números absolutos de LACartoons ("T1 E221" de Dragon Ball Z).
 */
export async function getSeasonCounts(imdbId: string): Promise<Map<number, number> | null> {
  const cached = seasonCache.get(imdbId);
  if (cached && Date.now() - cached.at < ONE_DAY_MS) return cached.counts;

  const { headers, search } = getTmdbHeaders();
  try {
    search.set("external_source", "imdb_id");
    const found = await fetch(`${BASE}/find/${encodeURIComponent(imdbId)}?${search}`, { headers, signal: AbortSignal.timeout(6000) });
    const tvId = found.ok ? ((await found.json()) as { tv_results?: { id: number }[] }).tv_results?.[0]?.id : undefined;
    let counts: Map<number, number> | null = null;
    if (tvId) {
      search.delete("external_source");
      const res = await fetch(`${BASE}/tv/${tvId}?${search}`, { headers, signal: AbortSignal.timeout(6000) });
      const data = res.ok ? ((await res.json()) as { seasons?: { season_number: number; episode_count: number }[] }) : null;
      const seasons = (data?.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count > 0).sort((a, b) => a.season_number - b.season_number);
      if (seasons.length > 0) counts = new Map(seasons.map((s) => [s.season_number, s.episode_count]));
    }
    seasonCache.set(imdbId, { counts, at: Date.now() });
    return counts;
  } catch (err) {
    console.warn(`[imdb] Error al buscar temporadas de ${imdbId}:`, err);
    return null;
  }
}
