import "server-only";
import { findTmdbArt } from "./tmdb";

/**
 * Reemplaza los pósters de LACartoons (chicos y de baja calidad) por los de TMDB cuando hay
 * una coincidencia confiable. Si TMDB no tiene la serie, queda la imagen original.
 */
export async function withArtwork<T extends { name: string; poster: string | null; background?: string | null; releaseInfo?: string | null }>(
  series: T,
): Promise<T> {
  const year = series.releaseInfo ? Number.parseInt(series.releaseInfo, 10) : null;
  const art = await findTmdbArt(series.name, Number.isFinite(year) ? year : null).catch(() => null);
  if (!art) return series;
  return {
    ...series,
    poster: art.poster ?? series.poster,
    ...("background" in series ? { background: art.backdrop ?? series.background ?? null } : {}),
  };
}

export function withArtworkAll<T extends { name: string; poster: string | null }>(list: T[]): Promise<T[]> {
  return Promise.all(list.map((s) => withArtwork(s)));
}
