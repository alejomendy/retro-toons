import "server-only";
import { showById } from "@/data/shows";
import { getDaySchedule, getEpisode, getEpisodes } from "@/lib/schedule";
import { findTmdb, findTmdbId, getTmdbSeason, getTmdbShow, type TmdbEpisode, type TmdbShow } from "@/lib/tmdb";
import { getWikipediaEpisodes, getWikipediaSummary, type WikiEpisode } from "@/lib/wikipedia";
import { normalize } from "@/lib/text";
import { getDoblajeTitles } from "@/lib/doblaje";
import { fanWikiUrl, getFanWikiTitles } from "@/lib/fanwiki";
import { findYoutubeVideo } from "@/lib/youtube";
import { findDailymotionVideo } from "@/lib/dailymotion";
import type { ChannelId, Episode, Show, ShowExtras, Slot, VideoSource } from "@/lib/types";

/**
 * Une el catálogo local con las APIs externas. Todo lo que se muestra está en español,
 * priorizando el doblaje latino:
 *   - TMDB → temporadas, pósters, dónde ver, y títulos/sinopsis en es-MX.
 *   - Wikis de fans (configuradas por serie) y Doblaje Wiki → títulos latinos que TMDB no tiene en es-MX.
 *   - Wikipedia ES → descripción de la serie y títulos/sinopsis de sus anexos de episodios.
 *   - TMDB es-ES (España) → último recurso.
 *   - YouTube / Dailymotion → fuente de video si no hay una en data/videos.ts.
 * Si un episodio no tiene título en español en ninguna fuente, se muestra
 * "Temporada X · Episodio Y" (nunca el título en inglés).
 */

async function loadTmdb(show: Show): Promise<TmdbShow | null> {
  const id = show.tmdbId ?? (await findTmdbId(show.originalTitle, show.year));
  return id ? getTmdbShow(id) : null;
}

/** Número absoluto (1..N) → temporada y episodio según las temporadas de TMDB. */
function locate(tmdb: TmdbShow, n: number): { season: number; index: number } | null {
  let rest = n;
  for (const s of tmdb.seasons) {
    if (rest <= s.episodeCount) return { season: s.number, index: rest - 1 };
    rest -= s.episodeCount;
  }
  return null;
}

function toEpisode(base: Episode, t?: TmdbEpisode): Episode {
  if (!t) return base;
  return {
    ...base,
    title: t.name ? `T${t.season}·E${t.number} — ${t.name}` : `Temporada ${t.season} · Episodio ${t.number}`,
    minutes: t.runtime && t.runtime <= 30 ? t.runtime : base.minutes,
    season: t.season,
    numberInSeason: t.number,
    airdate: t.airDate ?? undefined,
    summary: t.overview ?? undefined,
    image: t.still ?? undefined,
  };
}

/**
 * Busca un episodio por su título original en un índice (título original normalizado → dato).
 * Si no está entero prueba por segmentos ("A / B"), que algunas fuentes listan por separado.
 */
function lookup<T>(index: Map<string, T>, originalName: string, join: (parts: T[]) => T): T | null {
  const direct = index.get(normalize(originalName));
  if (direct) return direct;
  const parts = originalName.split("/").map((p) => index.get(normalize(p)));
  return parts.length > 1 && parts.every(Boolean) ? join(parts as T[]) : null;
}

/** "Los Sustitutos" → también "Los sustitutos" (los títulos de las wikis distinguen mayúsculas). */
function nameVariants(names: (string | null | undefined)[]): string[] {
  const clean = names.filter((n): n is string => !!n);
  return [...new Set(clean.flatMap((n) => [n, n.charAt(0) + n.slice(1).toLowerCase()]))];
}

interface EpisodeData {
  episodes: Map<number, TmdbEpisode>;
  credits: { name: string; url: string }[];
}

/**
 * Trae las temporadas necesarias y devuelve el episodio de cada número absoluto,
 * con el mejor título en español disponible:
 * TMDB es-MX → wiki de fans → Doblaje Wiki → Wikipedia ES → TMDB es-ES → wiki de fans (España).
 */
async function tmdbEpisodes(show: Show, tmdb: TmdbShow | null, numbers: number[]): Promise<EpisodeData> {
  const episodes = new Map<number, TmdbEpisode>();
  if (!tmdb) return { episodes, credits: [] };
  const located = numbers.map((n) => [n, locate(tmdb, n)] as const);
  const seasons = [...new Set(located.flatMap(([, l]) => (l ? [l.season] : [])))];
  const data = new Map(await Promise.all(seasons.map(async (s) => [s, await getTmdbSeason(tmdb.id, s)] as const)));
  for (const [n, l] of located) {
    const ep = l ? data.get(l.season)?.[l.index] : undefined;
    if (ep) episodes.set(n, { ...ep });
  }

  const credits = new Map<string, string>();
  const incomplete = [...episodes.values()].filter((e) => !e.name || !e.overview);
  if (incomplete.length > 0) {
    const names = nameVariants([show.title, tmdb.name, show.originalTitle]);
    const originals = incomplete.flatMap((e) => (e.originalName ? [e.originalName, ...e.originalName.split("/")] : []));
    const [fan, doblaje, wiki] = await Promise.all([
      show.fanWiki ? getFanWikiTitles(show.fanWiki, originals) : null,
      getDoblajeTitles(names),
      getWikipediaEpisodes(names),
    ]);
    const joinTitles = (p: string[]) => p.join(" / ");
    for (const e of incomplete) {
      const original = e.originalName;
      const fromFan = original && fan ? lookup(fan.latino, original, joinTitles) : null;
      const fromDoblaje = original ? lookup(doblaje.titles, original, joinTitles) : null;
      const w = original
        ? lookup<WikiEpisode>(wiki, original, (p) => ({ title: p.map((x) => x.title).join(" / "), summary: p.map((x) => x.summary).filter(Boolean).join(" ") || null }))
        : null;
      // Nunca aceptar algo idéntico al inglés.
      const wikiTitle = w && original && normalize(w.title) !== normalize(original) ? w.title : null;
      const fanSpain = original && fan ? lookup(fan.spain, original, joinTitles) : null;

      if (!e.name && (fromFan || (!fromDoblaje && !wikiTitle && !e.nameSpain && fanSpain)) && show.fanWiki) {
        credits.set("Wiki de fans (CC BY-SA)", fanWikiUrl(show.fanWiki));
      } else if (!e.name && fromDoblaje && doblaje.url) {
        credits.set("Doblaje Wiki (CC BY-SA)", doblaje.url);
      }
      e.name ??= fromFan ?? fromDoblaje ?? wikiTitle ?? e.nameSpain ?? fanSpain;
      e.overview ??= w?.summary ?? e.overviewSpain;
    }
  } else {
    for (const e of episodes.values()) e.overview ??= e.overviewSpain;
  }
  return { episodes, credits: [...credits].map(([name, url]) => ({ name, url })) };
}

export async function getShowWithEpisodes(show: Show): Promise<{ show: Show; extras: ShowExtras; episodes: Episode[] }> {
  const [tmdb, wiki] = await Promise.all([loadTmdb(show), getWikipediaSummary(`${show.title} serie animada`)]);
  const base = getEpisodes(show);
  const { episodes: eps, credits } = await tmdbEpisodes(show, tmdb, base.map((e) => e.number));
  const episodes = base.map((e) => toEpisode(e, eps.get(e.number)));

  const extras: ShowExtras = {
    localTitle: tmdb?.name ?? null,
    summary: tmdb?.overview ?? wiki?.extract ?? null,
    summarySource: tmdb?.overview ? "tmdb" : wiki?.extract ? "wikipedia" : null,
    image: tmdb?.poster ?? wiki?.image ?? null,
    backdrop: tmdb?.backdrop ?? null,
    videos: tmdb?.videos ?? [],
    providers: tmdb?.providers ?? [],
    providersLink: tmdb?.providersLink ?? null,
    wikipediaUrl: wiki?.url ?? null,
    credits,
    tmdbId: tmdb?.id ?? null,
  };
  return { show, extras, episodes };
}

export async function getFullEpisode(show: Show, number: number): Promise<Episode> {
  const tmdb = await loadTmdb(show);
  const t = (await tmdbEpisodes(show, tmdb, [number])).episodes.get(number);
  const episode = toEpisode(getEpisode(show, number), t);
  const episodeNames = [t?.name, t?.originalName].filter((n): n is string => !!n);
  return { ...episode, source: await resolveSource(show, episode, tmdb?.name, episodeNames) };
}

/** 1) data/videos.ts  2) YouTube  3) Dailymotion  4) sin fuente. */
export async function resolveSource(
  show: Show,
  episode: Episode,
  localTitle?: string,
  episodeNames: string[] = [],
): Promise<VideoSource | undefined> {
  if (episode.source) return episode.source;
  // Sin ningún nombre de episodio no hay forma de verificar que el video sea el correcto.
  if (episodeNames.length === 0) return undefined;
  const series = localTitle ?? show.title;
  const query = `${series} ${episodeNames[0]} español latino`;
  // El video tiene que nombrar la serie y el episodio para no pasar un capítulo equivocado.
  const names = [show.title, show.originalTitle, ...(localTitle ? [localTitle] : [])];
  return (await findYoutubeVideo(query, names, episodeNames)) ?? (await findDailymotionVideo(query, names, episodeNames));
}

/** Grilla del día con títulos en español (las fuentes de video se piden aparte para cuidar la cuota). */
export async function getEnrichedSchedule(channelId: ChannelId, date: Date): Promise<Slot[]> {
  const slots = getDaySchedule(channelId, date);
  const ids = [...new Set(slots.map((s) => s.show.id))];

  const data = new Map(
    await Promise.all(
      ids.map(async (id) => {
        const tmdb = await loadTmdb(showById[id]);
        const numbers = slots.filter((s) => s.show.id === id).map((s) => s.episode.number);
        return [id, await tmdbEpisodes(showById[id], tmdb, numbers)] as const;
      }),
    ),
  );

  return slots.map((s) => ({ ...s, episode: toEpisode(s.episode, data.get(s.show.id)?.episodes.get(s.episode.number)) }));
}

/** Pósters de TMDB para la grilla de la biblioteca. */
export async function getPosters(list: Show[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    list.map(async (s) => {
      const poster = s.tmdbId ? (await getTmdbShow(s.tmdbId))?.poster : (await findTmdb(s.originalTitle, s.year))?.poster;
      return [s.id, poster] as const;
    }),
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1]));
}

/** "2026-10-29" → Date local a medianoche (o hoy si es inválida). */
export function parseDateParam(value: string | null): Date {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
