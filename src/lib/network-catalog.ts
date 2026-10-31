import "server-only";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const CACHE_SECONDS = 60 * 60 * 12;

export const CARTOON_NETWORKS = {
  "cartoon-network": { id: 56, label: "Cartoon Network", accent: "#00a8e0" },
  "disney-channel": { id: 54, label: "Disney Channel", accent: "#1676d2" },
} as const;

export type NetworkKey = keyof typeof CARTOON_NETWORKS;

export interface NetworkShow {
  id: number;
  name: string;
  originalName: string;
  overview: string;
  firstAirDate: string | null;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  genres: number[];
  originalLanguage: string;
}

interface DiscoverResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: Array<{
    id: number;
    name: string;
    original_name: string;
    overview?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    genre_ids?: number[];
    original_language?: string;
  }>;
}

function enabled() {
  return Boolean(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);
}

async function request<T>(path: string, params: Record<string, string>): Promise<T | null> {
  if (!enabled()) return null;
  const search = new URLSearchParams(params);
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env.TMDB_READ_TOKEN) headers.Authorization = `Bearer ${process.env.TMDB_READ_TOKEN}`;
  else search.set("api_key", process.env.TMDB_API_KEY!);

  try {
    const response = await fetch(`${TMDB_BASE}${path}?${search}`, {
      headers,
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function discoverNetworkShows(network: NetworkKey, page = 1) {
  const config = CARTOON_NETWORKS[network];
  const safePage = Math.min(500, Math.max(1, Math.floor(page)));
  const data = await request<DiscoverResponse>("/discover/tv", {
    with_networks: String(config.id),
    include_adult: "false",
    include_null_first_air_dates: "false",
    language: "es-MX",
    page: String(safePage),
    sort_by: "popularity.desc",
  });
  if (!data) return null;
  return {
    network,
    networkName: config.label,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
    results: data.results.map((item): NetworkShow => ({
      id: item.id,
      name: item.name,
      originalName: item.original_name,
      overview: item.overview ?? "",
      firstAirDate: item.first_air_date || null,
      poster: item.poster_path ? `${IMAGE_BASE}/w500${item.poster_path}` : null,
      backdrop: item.backdrop_path ? `${IMAGE_BASE}/w1280${item.backdrop_path}` : null,
      rating: item.vote_average ?? 0,
      genres: item.genre_ids ?? [],
      originalLanguage: item.original_language ?? "",
    })),
  };
}
