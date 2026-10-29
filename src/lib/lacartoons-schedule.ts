import "server-only";
import { unstable_cache } from "next/cache";
import { channelById } from "@/data/channels";
import { showById } from "@/data/shows";
import { dayNumber, toMinutes } from "./schedule";
import { getAvailableEpisodes, getFullEpisode, getPosters } from "./catalog";
import { fetchCatalog, fetchSeries, LcError } from "./lacartoons";
import type { LcSeries, LcSeriesSummary, LcSlot } from "./lacartoons-types";
import type { ChannelId, Show, VideoSource } from "./types";

/**
 * Programación del día con series reales de LACartoons.
 *
 * Cada bloque pasa las series icónicas que tiene asignadas en data/channels.ts
 * (sus `shows` + los clásicos extra de `lacartoons`), buscadas por nombre en el catálogo.
 * Las que LACartoons no tiene salen de las fuentes legales de lib/catalog.ts (canales oficiales
 * de YouTube, Pluto TV, data/videos.ts), si tienen episodios ahí.
 * Si a un bloque le quedan menos de cuatro disponibles, suma las icónicas de todo el canal;
 * y si el canal tiene muy pocas, se completa con otras de sus cadenas.
 * Es determinística: misma fecha + mismo canal = misma grilla para todos los visitantes.
 */

/** Mínimo de series distintas por canal antes de completar con el resto de sus cadenas. */
const MIN_CHANNEL_SERIES = 6;
/** Mínimo de series propias de un bloque antes de sumarle las del resto del canal. */
const MIN_BLOCK_SERIES = 4;
/** Prefijo de las series que no están en LACartoons y salen de otra fuente legal. */
const EXTERNAL = "ext:";
/** Duración mínima (min) de un episodio externo para ocupar un espacio de la grilla. */
const MIN_EXTERNAL_MINUTES = 15;
const MAX_CATALOG_PAGES = 40;
const DAY_MINUTES = 24 * 60;
const CACHE_SECONDS = 6 * 60 * 60;

/** Todo el catálogo (viene paginado de a 20). */
const fullCatalog = unstable_cache(
  async (): Promise<LcSeriesSummary[]> => {
    const all: LcSeriesSummary[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
      const fresh = (await fetchCatalog({ skip: all.length })).filter((s) => !seen.has(s.id));
      if (fresh.length === 0) break;
      for (const s of fresh) seen.add(s.id);
      all.push(...fresh);
    }
    if (all.length === 0) throw new LcError("MALFORMED_DATA", "El catálogo de LACartoons vino vacío.");
    return all;
  },
  ["lacartoons-full-catalog"],
  { revalidate: CACHE_SECONDS },
);

const cachedSeries = unstable_cache((id: string) => fetchSeries(id), ["lacartoons-series"], { revalidate: CACHE_SECONDS });

/** Para comparar nombres: sin tildes, signos ni palabras de relleno ("La Serie Animada", "El", "Las"...). */
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(el|la|los|las|de|del|y|the|and|of|serie|series|animada|animated|aventuras)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca una serie del catálogo por cualquiera de sus nombres: primero exacto, después la coincidencia más corta. */
function findByName(names: string[], catalog: { series: LcSeriesSummary; key: string }[]): LcSeriesSummary | undefined {
  const keys = names.map(normalize).filter((k) => k.length >= 3);
  const exact = catalog.find((c) => keys.includes(c.key));
  if (exact) return exact.series;
  const partial = catalog
    .filter((c) => c.key.length >= 4 && keys.some((k) => c.key.includes(k) || k.includes(c.key)))
    .sort((a, b) => a.key.length - b.key.length);
  return partial[0]?.series;
}

/** Generador pseudoaleatorio con semilla (mulberry32): mismo día, mismo resultado. */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffled<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const unique = <T,>(list: T[]) => [...new Set(list)];

export async function getLcSchedule(channelId: ChannelId, date: Date): Promise<LcSlot[]> {
  const channel = channelById[channelId];
  const day = dayNumber(date);
  const random = seededRandom(hash(channelId) ^ day);

  const catalog = (await fullCatalog()).map((series) => ({ series, key: normalize(series.name) }));

  // Series icónicas de cada bloque: las que están en LACartoons van por su ID;
  // las que no, quedan como candidatas a una fuente legal propia (ver lib/catalog.ts).
  const blockKeys = channel.blocks.map((block) => {
    const keys: string[] = [];
    for (const show of block.shows.map((id) => showById[id]).filter(Boolean)) {
      const found = findByName([show.lacartoons, show.title, show.originalTitle].filter((n): n is string => !!n), catalog);
      keys.push(found ? found.id : `${EXTERNAL}${show.id}`);
    }
    for (const name of block.lacartoons ?? []) {
      const found = findByName([name], catalog);
      if (found) keys.push(found.id);
    }
    return unique(keys);
  });

  // Solo sirven las que tienen episodios.
  const iconicKeys = unique(blockKeys.flat());
  const loaded = new Map<string, LcSeries>();
  const load = async (ids: string[]) => {
    const metas = await Promise.all(ids.map((id) => cachedSeries(id).catch(() => null)));
    for (const s of metas) if (s && s.videos.length > 0) loaded.set(s.id, s);
  };
  const external = new Map<string, { show: Show; numbers: number[] }>();
  await Promise.all([
    load(iconicKeys.filter((k) => !k.startsWith(EXTERNAL))),
    ...iconicKeys
      .filter((k) => k.startsWith(EXTERNAL))
      .map(async (key) => {
        const show = showById[key.slice(EXTERNAL.length)];
        // Episodios cortos (segmentos de 7-11 min) dejarían casi todo el espacio en tanda.
        if (show.episodeMinutes < MIN_EXTERNAL_MINUTES) return;
        const numbers = await getAvailableEpisodes(show).catch(() => []);
        if (numbers.length > 0) external.set(key, { show, numbers });
      }),
  ]);
  const playable = (key: string) => loaded.has(key) || external.has(key);
  let channelPool = iconicKeys.filter(playable);

  // Canal con pocas icónicas disponibles: se completa con otras de sus cadenas (rotan cada día).
  if (channelPool.length < MIN_CHANNEL_SERIES) {
    const genrePool = catalog
      .filter((c) => !channelPool.includes(c.series.id) && c.series.genres.some((g) => channel.lacartoons.includes(g)))
      .map((c) => c.series.id)
      .sort();
    const extra = shuffled(genrePool, random).slice(0, (MIN_CHANNEL_SERIES - channelPool.length) * 2);
    await load(extra);
    channelPool = [...channelPool, ...extra.filter((id) => loaded.has(id)).slice(0, MIN_CHANNEL_SERIES - channelPool.length)];
  }
  if (channelPool.length === 0) throw new LcError("NO_EPISODES", `No encontramos episodios de ${channel.name} para hoy.`);

  const slots: LcSlot[] = [];
  /** Espacios de fuentes externas: se completan después con el episodio y su video. */
  const pending: { slot: LcSlot; show: Show; number: number }[] = [];
  const airedToday = new Map<string, number>();

  channel.blocks.forEach((block, b) => {
    const own = blockKeys[b].filter(playable);
    // Con pocas series propias el bloque repetiría lo mismo durante horas: se suman las icónicas del canal.
    const pool = own.length >= MIN_BLOCK_SERIES ? own : unique([...own, ...channelPool]);
    const length = block.slotMinutes ?? 30;
    const end = Math.min(toMinutes(block.end), DAY_MINUTES);
    // Cada día el bloque arranca por una serie distinta.
    const offset = day % pool.length;
    for (let t = toMinutes(block.start), i = 0; t < end; t += length, i++) {
      const key = pool[(offset + i) % pool.length];
      const nth = airedToday.get(key) ?? 0;
      airedToday.set(key, nth + 1);
      // Las repeticiones avanzan día a día por la lista real de episodios.
      const pick = (count: number) => (day * 7 + nth) % count;
      const time = { start: t, end: Math.min(t + length, end), block: block.name };

      const ext = external.get(key);
      if (ext) {
        const number = ext.numbers[pick(ext.numbers.length)];
        const slot: LcSlot = {
          ...time,
          series: { id: ext.show.id, name: ext.show.title, poster: null },
          episode: { id: `${ext.show.id}:${number}`, title: `Episodio ${number}`, season: 1, episode: number },
          external: { minutes: ext.show.episodeMinutes, via: "" },
        };
        slots.push(slot);
        pending.push({ slot, show: ext.show, number });
        continue;
      }

      const series = loaded.get(key)!;
      const ep = series.videos[pick(series.videos.length)];
      slots.push({
        ...time,
        series: { id: series.id, name: series.name, poster: series.poster },
        episode: { id: ep.id, title: ep.title, season: ep.season, episode: ep.episode },
      });
    }
  });

  // Título en español, temporada y video de cada episodio externo (TMDB + canal oficial / Pluto TV).
  const posters = await getPosters(unique(pending.map((p) => p.show))).catch((): Record<string, string> => ({}));
  await Promise.all(
    pending.map(async ({ slot, show, number }) => {
      const ep = await getFullEpisode(show, number).catch(() => null);
      slot.series.poster = posters[show.id] ?? null;
      if (!ep) return;
      slot.episode = {
        id: slot.episode.id,
        // getFullEpisode antepone "T1·E2 — " al título; acá la temporada se muestra aparte.
        title: ep.title.replace(/^T\d+·E\d+ — /, ""),
        season: ep.season ?? 1,
        episode: ep.numberInSeason ?? number,
      };
      slot.external = { source: ep.source, minutes: Math.min(ep.minutes, show.episodeMinutes) || show.episodeMinutes, url: externalUrl(ep.source), via: sourceName(ep.source) };
    }),
  );

  return slots;
}

function externalUrl(source?: VideoSource): string | undefined {
  switch (source?.type) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${source.id}`;
    case "dailymotion":
      return `https://www.dailymotion.com/video/${source.id}`;
    case "hls":
      return source.pageUrl;
    default:
      return undefined;
  }
}

function sourceName(source?: VideoSource): string {
  switch (source?.type) {
    case "youtube":
      return "YouTube (canal oficial)";
    case "dailymotion":
      return "Dailymotion";
    case "hls":
      return "Pluto TV";
    default:
      return "Fuente externa";
  }
}
