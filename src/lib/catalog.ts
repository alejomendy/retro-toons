import "server-only";
import { showById } from "@/data/shows";
import { getDaySchedule, getEpisode, getEpisodes } from "@/lib/schedule";
import { getTvmazeShow, type TvmazeEpisode, type TvmazeShow } from "@/lib/tvmaze";
import { findTmdbId, getTmdbSeason, getTmdbShow, type TmdbEpisode, type TmdbShow } from "@/lib/tmdb";
import { getWikipediaSummary } from "@/lib/wikipedia";
import { findYoutubeVideo } from "@/lib/youtube";
import { findDailymotionVideo } from "@/lib/dailymotion";
import type { ChannelId, Episode, Show, ShowExtras, Slot, VideoSource } from "@/lib/types";

/**
 * Une el catálogo local con las APIs externas, priorizando español latino:
 *   - TMDB (es-MX) → títulos y sinopsis en español, pósters, fondos, openings, dónde ver.
 *   - Wikipedia ES → descripción en español si no hay TMDB.
 *   - TVmaze       → estructura de temporadas/episodios y respaldo en inglés.
 *   - YouTube / Dailymotion → fuente de video si no hay una en data/videos.ts.
 * Si una API falla, se usa lo que haya y el sitio sigue funcionando.
 */

interface Sources {
  tv: TvmazeShow | null;
  tmdb: TmdbShow | null;
}

async function loadSources(show: Show): Promise<Sources> {
  const [tv, tmdbId] = await Promise.all([
    show.tvmazeId ? getTvmazeShow(show.tvmazeId) : null,
    show.tmdbId ?? findTmdbId(show.originalTitle, show.year),
  ]);
  return { tv, tmdb: tmdbId ? await getTmdbShow(tmdbId) : null };
}

const key = (season: number, number: number) => `${season}x${number}`;

/**
 * Títulos en español de TMDB indexados por temporada×episodio.
 * Solo usa temporadas con la misma cantidad de episodios que TVmaze: algunas
 * series cuentan segmentos de 11 min y otras episodios de 22, y no queremos
 * mostrar el título de otro episodio.
 */
async function spanishEpisodes({ tv, tmdb }: Sources, onlySeasons?: Set<number>): Promise<Map<string, TmdbEpisode>> {
  const map = new Map<string, TmdbEpisode>();
  if (!tv || !tmdb) return map;

  const tvCounts = new Map<number, number>();
  for (const e of tv.episodes) tvCounts.set(e.season, (tvCounts.get(e.season) ?? 0) + 1);

  const seasons = tmdb.seasons.filter(
    (s) => tvCounts.get(s.number) === s.episodeCount && (!onlySeasons || onlySeasons.has(s.number)),
  );
  const results = await Promise.all(seasons.map((s) => getTmdbSeason(tmdb.id, s.number)));
  for (const e of results.flat()) map.set(key(e.season, e.number), e);
  return map;
}

/** TMDB devuelve "Episodio N" cuando no hay traducción: lo tratamos como vacío. */
function usefulName(name?: string | null): string | null {
  return name && !/^Episodio \d+$/i.test(name) ? name : null;
}

function mergeEpisode(base: Episode, tv?: TvmazeEpisode, es?: TmdbEpisode): Episode {
  if (!tv) return base;
  const name = usefulName(es?.name) ?? tv.name;
  return {
    ...base,
    title: `T${tv.season}·E${tv.number} — ${name}`,
    minutes: tv.runtime && tv.runtime <= 30 ? tv.runtime : base.minutes,
    season: tv.season,
    numberInSeason: tv.number,
    airdate: tv.airdate || undefined,
    summary: es?.overview ?? tv.summary ?? undefined,
    image: es?.still ?? tv.image ?? undefined,
  };
}

function seasonOf(tv: TvmazeShow | null, n: number): Set<number> {
  const ep = tv?.episodes[n - 1];
  return new Set(ep ? [ep.season] : []);
}

export async function getShowWithEpisodes(show: Show): Promise<{ show: Show; extras: ShowExtras; episodes: Episode[] }> {
  const [sources, wiki] = await Promise.all([loadSources(show), getWikipediaSummary(`${show.title} serie animada`)]);
  const { tv, tmdb } = sources;
  const es = await spanishEpisodes(sources);

  const episodes = getEpisodes(show).map((e) => {
    const t = tv?.episodes[e.number - 1];
    return mergeEpisode(e, t, t ? es.get(key(t.season, t.number)) : undefined);
  });

  const summary = tmdb?.overview ?? wiki?.extract ?? tv?.summary ?? null;
  const extras: ShowExtras = {
    localTitle: tmdb?.name ?? null,
    summary,
    summarySource: tmdb?.overview ? "tmdb" : wiki?.extract ? "wikipedia" : tv?.summary ? "tvmaze" : null,
    image: tmdb?.poster ?? tv?.image ?? wiki?.image ?? null,
    backdrop: tmdb?.backdrop ?? null,
    network: tv?.network ?? null,
    videos: tmdb?.videos ?? [],
    providers: tmdb?.providers ?? [],
    providersLink: tmdb?.providersLink ?? null,
    wikipediaUrl: wiki?.url ?? null,
    tmdbId: tmdb?.id ?? null,
  };
  return { show, extras, episodes };
}

export async function getFullEpisode(show: Show, number: number): Promise<Episode> {
  const sources = await loadSources(show);
  const es = await spanishEpisodes(sources, seasonOf(sources.tv, number));
  const t = sources.tv?.episodes[number - 1];
  const episode = mergeEpisode(getEpisode(show, number), t, t ? es.get(key(t.season, t.number)) : undefined);
  return { ...episode, source: await resolveSource(show, episode, sources.tmdb?.name) };
}

/** 1) data/videos.ts  2) YouTube  3) Dailymotion  4) sin fuente. */
export async function resolveSource(show: Show, episode: Episode, localTitle?: string): Promise<VideoSource | undefined> {
  if (episode.source) return episode.source;
  const series = localTitle ?? show.title;
  const name = episode.season ? episode.title.replace(/^T\d+·E\d+ — /, "") : `capítulo ${episode.number}`;
  const query = `${series} ${name} español latino`;
  // El video tiene que nombrar la serie (en cualquiera de sus títulos) para evitar falsos positivos.
  const names = [show.title, show.originalTitle, ...(localTitle ? [localTitle] : [])];
  return (await findYoutubeVideo(query, names)) ?? (await findDailymotionVideo(query, names));
}

/** Grilla del día con títulos en español (las fuentes de video se piden aparte para cuidar la cuota). */
export async function getEnrichedSchedule(channelId: ChannelId, date: Date): Promise<Slot[]> {
  const slots = getDaySchedule(channelId, date);
  const ids = [...new Set(slots.map((s) => s.show.id))];

  const data = new Map(
    await Promise.all(
      ids.map(async (id) => {
        const show = showById[id];
        const sources = await loadSources(show);
        const seasons = new Set(
          slots.filter((s) => s.show.id === id).flatMap((s) => [...seasonOf(sources.tv, s.episode.number)]),
        );
        return [id, { tv: sources.tv, es: await spanishEpisodes(sources, seasons) }] as const;
      }),
    ),
  );

  return slots.map((s) => {
    const d = data.get(s.show.id);
    const t = d?.tv?.episodes[s.episode.number - 1];
    return { ...s, episode: mergeEpisode(s.episode, t, t ? d?.es.get(key(t.season, t.number)) : undefined) };
  });
}

/** "2026-10-29" → Date local a medianoche (o hoy si es inválida). */
export function parseDateParam(value: string | null): Date {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
