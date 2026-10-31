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
  /** Gratis con publicidad (o gratis sin más), sin suscripción. */
  free: boolean;
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
  /** Título en español latino (es-MX) o null si no hay traducción. */
  name: string | null;
  /** Título en español de España: último recurso si no hay versión latina. */
  nameSpain: string | null;
  overview: string | null;
  overviewSpain: string | null;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
  /** Título en inglés: solo para buscar videos, nunca se muestra. */
  originalName: string | null;
}

type RawProvider = { provider_name: string; logo_path: string };

interface RawTv {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  seasons: { season_number: number; episode_count: number }[];
  videos?: { results: { key: string; name: string; site: string; type: string; iso_639_1: string }[] };
  "watch/providers"?: { results: Record<string, { link: string } & Partial<Record<"flatrate" | "ads" | "free", RawProvider[]>>> };
}

/** Busca la serie en TMDB por título original y año de estreno. */
export async function findTmdb(originalTitle: string, year: number): Promise<{ id: number; poster: string | null } | null> {
  type Res = { results: { id: number; poster_path: string | null }[] };
  const withYear = await tmdb<Res>("/search/tv", { query: originalTitle, first_air_date_year: String(year), language: LANG });
  const hit = withYear?.results[0] ?? (await tmdb<Res>("/search/tv", { query: originalTitle, language: LANG }))?.results[0];
  return hit ? { id: hit.id, poster: hit.poster_path ? `${IMG}/w342${hit.poster_path}` : null } : null;
}

/** Para comparar nombres de series: sin tildes, signos ni palabras de relleno. */
function nameKey(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["el", "la", "los", "las", "de", "del", "y", "the", "and", "of", "serie", "series", "animada", "animated", "a"].includes(w));
}

/** Parecido entre dos nombres (0..1): palabras en común sobre el nombre más largo. */
function similarity(a: string, b: string): number {
  const x = new Set(nameKey(a));
  const y = new Set(nameKey(b));
  if (x.size === 0 || y.size === 0) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.max(x.size, y.size);
}

/** Géneros de TMDB: 16 animación, 10762 infantil. */
const KIDS_GENRES = [16, 10762];

/**
 * Póster y fondo de TMDB para una serie de la que solo sabemos el nombre (ej. el de LACartoons).
 * Solo acepta un resultado animado/infantil cuyo nombre se parezca de verdad: mejor sin imagen que con la de otra serie.
 */
export async function findTmdbArt(name: string, year?: number | null): Promise<{ poster: string | null; backdrop: string | null } | null> {
  type Hit = { id: number; name: string; original_name: string; poster_path: string | null; backdrop_path: string | null; genre_ids: number[]; first_air_date?: string };
  type Res = { results: Hit[] };
  const query = name.replace(/\s*[:(].*$/, "").trim() || name;
  const res = await tmdb<Res>("/search/tv", { query, language: LANG, include_adult: "false" });
  const scored = (res?.results ?? [])
    .filter((h) => h.poster_path && h.genre_ids.some((g) => KIDS_GENRES.includes(g)))
    .map((h) => {
      const score = Math.max(similarity(name, h.name), similarity(name, h.original_name), similarity(query, h.name), similarity(query, h.original_name));
      const sameYear = year && h.first_air_date?.startsWith(String(year)) ? 0.15 : 0;
      return { h, score: score + sameYear };
    })
    .filter((s) => s.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  const hit = scored[0]?.h;
  if (!hit) return null;
  return {
    poster: hit.poster_path ? `${IMG}/w342${hit.poster_path}` : null,
    backdrop: hit.backdrop_path ? `${IMG}/w1280${hit.backdrop_path}` : null,
  };
}

export interface TmdbImdbMatch {
  tmdbId: number;
  type: "series" | "movie";
  name: string;
  originalName: string;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  year: number | null;
}

/** Ficha en español latino de un título a partir de su ID de IMDb (los addons de Stremio usan `tt...`). */
export async function findByImdb(imdbId: string): Promise<TmdbImdbMatch | null> {
  if (!/^tt\d{5,10}$/.test(imdbId)) return null;
  type Hit = { id: number; name?: string; title?: string; original_name?: string; original_title?: string; overview?: string; poster_path: string | null; backdrop_path: string | null; first_air_date?: string; release_date?: string };
  const res = await tmdb<{ tv_results: Hit[]; movie_results: Hit[] }>(`/find/${imdbId}`, { external_source: "imdb_id", language: LANG });
  const tv = res?.tv_results[0];
  const hit = tv ?? res?.movie_results[0];
  if (!hit) return null;
  const date = hit.first_air_date || hit.release_date;
  return {
    tmdbId: hit.id,
    type: tv ? "series" : "movie",
    name: hit.name || hit.title || "",
    originalName: hit.original_name || hit.original_title || "",
    overview: hit.overview?.trim() || null,
    poster: hit.poster_path ? `${IMG}/w342${hit.poster_path}` : null,
    backdrop: hit.backdrop_path ? `${IMG}/w1280${hit.backdrop_path}` : null,
    year: date ? Number(date.slice(0, 4)) : null,
  };
}

export async function findTmdbId(originalTitle: string, year: number): Promise<number | null> {
  return (await findTmdb(originalTitle, year))?.id ?? null;
}

export interface TmdbTitle {
  name: string;
  originalName: string;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
}

/** Nombre en español, sinopsis y arte de una serie o película por su id de TMDB (para los catálogos de los addons). */
export async function getTmdbTitle(kind: "tv" | "movie", id: number): Promise<TmdbTitle | null> {
  const raw = await tmdb<{
    name?: string;
    title?: string;
    original_name?: string;
    original_title?: string;
    overview?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date?: string;
    release_date?: string;
  }>(`/${kind}/${id}`, { language: LANG });
  const name = raw?.name ?? raw?.title;
  if (!raw || !name) return null;
  const date = raw.first_air_date || raw.release_date;
  return {
    name,
    originalName: raw.original_name ?? raw.original_title ?? name,
    overview: raw.overview || null,
    poster: raw.poster_path ? `${IMG}/w342${raw.poster_path}` : null,
    backdrop: raw.backdrop_path ? `${IMG}/w1280${raw.backdrop_path}` : null,
    year: date ? date.slice(0, 4) : null,
  };
}

export async function getTmdbShow(id: number): Promise<TmdbShow | null> {
  const raw = await tmdb<RawTv>(`/tv/${id}`, {
    language: LANG,
    append_to_response: "videos,watch/providers",
    // Solo videos en español: nada en inglés en la página.
    include_video_language: "es",
  });
  if (!raw) return null;

  const region = process.env.TMDB_REGION || "AR";
  const watch = raw["watch/providers"]?.results[region];
  const videos = (raw.videos?.results ?? [])
    .filter((v) => v.site === "YouTube" && v.iso_639_1 === "es")
    .map((v) => ({ key: v.key, name: v.name, type: v.type }));

  // Si no hay sinopsis latina, probar con la de España.
  const overview = raw.overview || (await tmdb<{ overview: string }>(`/tv/${id}`, { language: "es-ES" }))?.overview || null;

  return {
    id: raw.id,
    name: raw.name,
    overview,
    poster: raw.poster_path ? `${IMG}/w342${raw.poster_path}` : null,
    backdrop: raw.backdrop_path ? `${IMG}/w1280${raw.backdrop_path}` : null,
    seasons: raw.seasons.filter((s) => s.season_number > 0).map((s) => ({ number: s.season_number, episodeCount: s.episode_count })),
    videos,
    providers: providerList(watch),
    providersLink: watch?.link ?? null,
  };
}

/** Plataformas gratis (con publicidad) primero y después las de suscripción, sin repetir. */
function providerList(watch?: Partial<Record<"flatrate" | "ads" | "free", RawProvider[]>>): TmdbProvider[] {
  const out = new Map<string, TmdbProvider>();
  for (const [kind, free] of [["free", true], ["ads", true], ["flatrate", false]] as const) {
    for (const p of watch?.[kind] ?? []) {
      const name = p.provider_name.trim();
      if (!out.has(name)) out.set(name, { name, logo: `${IMG}/w92${p.logo_path}`, free });
    }
  }
  return [...out.values()];
}

type RawSeason = {
  episodes: {
    season_number: number;
    episode_number: number;
    name: string;
    overview: string;
    still_path: string | null;
    runtime: number | null;
    air_date: string | null;
  }[];
};

/** TMDB devuelve "Episodio N" cuando no hay traducción. */
function isGeneric(name?: string | null): boolean {
  return !name || /^(Episodio|Episode|Capítulo) \d+$/i.test(name.trim());
}

/**
 * Un título cuenta como traducido si no es genérico y no es idéntico al
 * inglés (salvo nombres de una sola palabra, como "Doug" o "Hamtaro").
 */
function spanishName(es: string | undefined, en: string | undefined): string | null {
  if (isGeneric(es)) return null;
  if (es === en && /\s/.test(es!.trim())) return null;
  return es!.trim();
}

/**
 * Episodios de una temporada con títulos y sinopsis en español latino (es-MX)
 * y de España (es-ES) por separado. Lo que no está traducido queda en null (nunca en inglés).
 */
export async function getTmdbSeason(id: number, season: number): Promise<TmdbEpisode[]> {
  const [mx, es, en] = await Promise.all(
    ["es-MX", "es-ES", "en-US"].map((language) => tmdb<RawSeason>(`/tv/${id}/season/${season}`, { language })),
  );
  const byNumber = (raw: RawSeason | null) => new Map((raw?.episodes ?? []).map((e) => [e.episode_number, e]));
  const esMap = byNumber(es);
  const enMap = byNumber(en);
  // Si es-MX no tiene traducción/publicación para la temporada, conservar
  // la estructura desde es-ES en vez de devolver una temporada vacía.
  const baseEpisodes = mx?.episodes?.length ? mx.episodes : es?.episodes ?? [];

  return baseEpisodes.map((e) => {
    const eMx = mx?.episodes?.find((entry) => entry.episode_number === e.episode_number);
    const eEs = esMap.get(e.episode_number);
    const enName = enMap.get(e.episode_number)?.name;
    return {
      season: e.season_number,
      number: e.episode_number,
      name: spanishName(eMx?.name, enName),
      nameSpain: spanishName(eEs?.name, enName),
      overview: eMx?.overview || null,
      overviewSpain: eEs?.overview || null,
      still: (eMx?.still_path || eEs?.still_path) ? `${IMG}/w300${eMx?.still_path || eEs?.still_path}` : null,
      runtime: eMx?.runtime ?? eEs?.runtime ?? null,
      airDate: eMx?.air_date ?? eEs?.air_date ?? null,
      originalName: enName && !isGeneric(enName) ? enName : null,
    };
  });
}
