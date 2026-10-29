import "server-only";

/**
 * Cliente de TVmaze (https://www.tvmaze.com/api) — gratis y sin API key.
 * Límite: 20 requests cada 10 s por IP, por eso cacheamos 1 día.
 */
const BASE = "https://api.tvmaze.com";
const ONE_DAY = 60 * 60 * 24;

export interface TvmazeEpisode {
  season: number;
  number: number;
  name: string;
  runtime: number | null;
  airdate: string;
  image: string | null;
  summary: string | null;
}

export interface TvmazeShow {
  id: number;
  name: string;
  premiered: string | null;
  summary: string | null;
  image: string | null;
  network: string | null;
  episodes: TvmazeEpisode[];
}

interface RawEpisode {
  season: number;
  number: number | null;
  name: string;
  type: string;
  runtime: number | null;
  airdate: string;
  image: { medium: string; original: string } | null;
  summary: string | null;
}

interface RawShow {
  id: number;
  name: string;
  premiered: string | null;
  summary: string | null;
  image: { medium: string; original: string } | null;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  _embedded?: { episodes: RawEpisode[] };
}

export function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
}

/** Devuelve la serie con sus episodios regulares, o null si TVmaze no responde. */
export async function getTvmazeShow(id: number): Promise<TvmazeShow | null> {
  try {
    const res = await fetch(`${BASE}/shows/${id}?embed=episodes`, {
      next: { revalidate: ONE_DAY },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawShow;
    return {
      id: raw.id,
      name: raw.name,
      premiered: raw.premiered,
      summary: stripHtml(raw.summary),
      // "medium" (210×295) alcanza para el póster y es mucho más liviano que el original.
      image: raw.image?.medium ?? raw.image?.original ?? null,
      network: raw.network?.name ?? raw.webChannel?.name ?? null,
      episodes: (raw._embedded?.episodes ?? [])
        .filter((e) => e.type === "regular" && e.number != null)
        .map((e) => ({
          season: e.season,
          number: e.number!,
          name: e.name,
          runtime: e.runtime,
          airdate: e.airdate,
          image: e.image?.medium ?? null,
          summary: stripHtml(e.summary),
        })),
    };
  } catch {
    return null;
  }
}
