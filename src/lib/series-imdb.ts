import "server-only";
import { showById } from "@/data/shows";
import playableList from "@/data/playable.json";
import lacartoonsImdb from "@/data/lacartoons-imdb.json";
import { findImdbId, getImdbIdFromTmdb, getSeasonCounts } from "./imdb";
import { getTorrentStreams, type StreamOptions } from "./torrentio";

/**
 * IMDb ID de una serie de la grilla o la biblioteca (lo que necesita Torrentio para buscar torrents).
 *
 * Para las de LACartoons se usa primero el mapeo del addon (data/lacartoons-imdb.json, sacado de su
 * mapping.json): buscarlas en TMDB por el nombre en español fallaba o daba otra serie en ~3 de cada 10,
 * y en esas el P2P nunca encontraba nada.
 */

const ANIME = /dragon ball|saint seiya|caballeros|sailor moon|ranma|pokemon|digimon|evangelion|inuyasha|sakura|yugioh|yu-gi-oh|slam dunk|samurai x|samurai champloo|cowboy bebop|trigun|zatch|shaman|beyblade|medabots|detective conan|mazinger|attack on titan|shingeki|demon slayer|kimetsu|jujutsu|hunter x hunter|bleach|naruto|one piece/i;

const resolved = new Map<string, { imdbId: string | null; isAnime: boolean }>();

export async function resolveSeriesImdb(seriesId: string): Promise<{ imdbId: string | null; isAnime: boolean }> {
  const cached = resolved.get(seriesId);
  if (cached) return cached;

  let isAnime = false;
  let imdbId: string | null = null;

  const local = showById[seriesId];
  if (local) {
    isAnime = local.genre?.toLowerCase().includes("anime") || (local.channels && local.channels.length === 0);
    imdbId = local.tmdbId ? await getImdbIdFromTmdb(local.tmdbId) : await findImdbId(local.originalTitle || local.title, local.year);
  } else {
    const name = (playableList.series as Record<string, { name: string } | undefined>)[seriesId]?.name;
    isAnime = !!name && ANIME.test(name);
    imdbId = (lacartoonsImdb as Record<string, string | undefined>)[seriesId] ?? (name ? await findImdbId(name) : null);
  }

  const result = { imdbId, isAnime };
  // Un fallo de red no queda guardado: la próxima vez se vuelve a buscar.
  if (imdbId) resolved.set(seriesId, result);
  return result;
}

/**
 * Temporada y episodio "reales" (los de IMDb/Torrentio) de un episodio de LACartoons. Algunas series
 * vienen con numeración absoluta ("T1 E221" en Dragon Ball Z, "E119" en Futurama): si el número se pasa
 * de los episodios que tiene esa temporada, se cuenta a lo largo de todas las temporadas.
 */
export async function torrentEpisode(imdbId: string, season: number, episode: number): Promise<{ season: number; episode: number }> {
  const counts = await getSeasonCounts(imdbId).catch(() => null);
  const inSeason = counts?.get(season);
  if (!counts || inSeason === undefined || episode <= inSeason) return { season, episode };
  // El absoluto arranca en la temporada que trae LACartoons (casi siempre la 1).
  let left = episode;
  for (const [s, count] of counts) {
    if (s < season) continue;
    if (left <= count) return { season: s, episode: left };
    left -= count;
  }
  return { season, episode };
}

/** Torrents de un episodio, con la numeración corregida (ver torrentEpisode). */
export async function episodeTorrents(imdbId: string, season: number, episode: number, options?: StreamOptions) {
  const real = await torrentEpisode(imdbId, season, episode);
  return getTorrentStreams(imdbId, real.season, real.episode, options);
}
