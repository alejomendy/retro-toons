import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { blocksForDay, channelById } from "@/data/channels";
import { showById } from "@/data/shows";
import { dayNumber, toMinutes } from "./schedule";
import { getAvailableEpisodes, getFullEpisode, getPosters } from "./catalog";
import { fetchCatalog, fetchSeries, fetchStreamsCached, LcError } from "./lacartoons";
import { withArtwork } from "./artwork";
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

// Con el póster de TMDB ya aplicado (se usa en la tele del inicio y en la grilla).
const cachedSeries = unstable_cache(async (id: string) => withArtwork(await fetchSeries(id)), ["lacartoons-series-art"], { revalidate: CACHE_SECONDS });

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

/**
 * ¿La serie tiene video que el navegador pueda reproducir? Se prueba un episodio (todos suelen estar en
 * el mismo host) y el resultado se guarda 24 h. Si el addon no contesta a tiempo, se asume que sí
 * (no se guarda) para no vaciar la grilla por un addon dormido.
 */
const playableCache = unstable_cache(
  async (episodeId: string) => {
    // La cola solo frena las consultas reales al addon; si ya está en caché, esto ni se ejecuta.
    if (activeProbes >= MAX_PROBES) await new Promise<void>((resolve) => probeQueue.push(resolve));
    activeProbes++;
    try {
      return (await fetchStreamsCached(episodeId)).length > 0;
    } finally {
      activeProbes--;
      probeQueue.shift()?.();
    }
  },
  ["lacartoons-playable-v2"],
  { revalidate: 24 * 60 * 60 },
);

/** Pocas consultas de fuentes a la vez: el addon (plan gratis) tiene muy poca CPU. */
const MAX_PROBES = 2;
let activeProbes = 0;
const probeQueue: (() => void)[] = [];

async function probe(series: LcSeries): Promise<boolean> {
  try {
    return await playableCache(series.videos[0].id);
  } catch {
    return true;
  }
}

/** Tiempo máximo que la grilla espera las pruebas (Vercel corta a los 60 s y el addon puede tardar 30 s por episodio). */
const PROBE_BUDGET_MS = 20_000;

/**
 * Prueba con tope de tiempo: lo que no termina a tiempo se da por reproducible en esta grilla
 * y la prueba sigue después de responder (`after`), así la próxima visita ya la tiene en caché.
 */
function isPlayableWithin(series: LcSeries, deadline: number, pending: Promise<unknown>[]): Promise<boolean> {
  const result = probe(series);
  pending.push(result);
  const left = Math.max(0, deadline - Date.now());
  return Promise.race([result, new Promise<boolean>((resolve) => setTimeout(() => resolve(true), left))]);
}

export async function getLcSchedule(channelId: ChannelId, date: Date): Promise<LcSlot[]> {
  const channel = channelById[channelId];
  const day = dayNumber(date);
  const random = seededRandom(hash(channelId) ^ day);

  const catalog = (await fullCatalog()).map((series) => ({ series, key: normalize(series.name) }));
  // La programación cambia según el día de la semana (franjas de lunes a viernes, sábado y domingo).
  const blocks = blocksForDay(channel, date.getDay());

  // Series icónicas de cada bloque: las que están en LACartoons van por su ID;
  // las que no, quedan como candidatas a una fuente legal propia (ver lib/catalog.ts).
  /** Serie local de la que salió cada ID de LACartoons: si ahí no se puede ver, se prueba su fuente propia. */
  const localOf = new Map<string, Show>();
  let blockKeys = blocks.map((block) => {
    const keys: string[] = [];
    for (const show of (block.shows ?? []).map((id) => showById[id]).filter(Boolean)) {
      const found = findByName([show.lacartoons, show.title, show.originalTitle].filter((n): n is string => !!n), catalog);
      if (found) localOf.set(found.id, show);
      keys.push(found ? found.id : `${EXTERNAL}${show.id}`);
    }
    for (const name of block.lacartoons ?? []) {
      const found = findByName([name], catalog);
      if (found) keys.push(found.id);
    }
    return unique(keys);
  });

  // Solo sirven las que tienen episodios que se puedan reproducir.
  const loaded = new Map<string, LcSeries>();
  const unplayable = new Set<string>();
  const deadline = Date.now() + PROBE_BUDGET_MS;
  const probes: Promise<unknown>[] = [];
  after(() => Promise.allSettled(probes));
  const load = async (ids: string[]) => {
    const metas = await Promise.all(ids.map((id) => cachedSeries(id).catch(() => null)));
    await Promise.all(
      metas.map(async (s) => {
        if (!s || s.videos.length === 0) return;
        if (await isPlayableWithin(s, deadline, probes)) loaded.set(s.id, s);
        else unplayable.add(s.id);
      }),
    );
  };
  await load(unique(blockKeys.flat()).filter((k) => !k.startsWith(EXTERNAL)));
  // Las icónicas que LACartoons tiene pero sin video (ej. alojadas en hosts que el addon no extrae)
  // pasan a buscarse en las fuentes legales propias.
  blockKeys = blockKeys.map((keys) => unique(keys.map((k) => (unplayable.has(k) && localOf.has(k) ? `${EXTERNAL}${localOf.get(k)!.id}` : k))));
  const iconicKeys = unique(blockKeys.flat());

  const external = new Map<string, { show: Show; numbers: number[] }>();
  await Promise.all(
    iconicKeys
      .filter((k) => k.startsWith(EXTERNAL))
      .map(async (key) => {
        const show = showById[key.slice(EXTERNAL.length)];
        // Episodios cortos (segmentos de 7-11 min) dejarían casi todo el espacio en tanda.
        if (show.episodeMinutes < MIN_EXTERNAL_MINUTES) return;
        const numbers = await getAvailableEpisodes(show).catch(() => []);
        if (numbers.length > 0) external.set(key, { show, numbers });
      }),
  );
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

  blocks.forEach((block, b) => {
    const own = blockKeys[b].filter(playable);
    // Con pocas series propias el bloque repetiría lo mismo durante horas: se suman las icónicas del canal.
    // Las maratones (exclusive) pasan solo lo suyo.
    const pool = own.length >= MIN_BLOCK_SERIES || (block.exclusive && own.length > 0) ? own : unique([...own, ...channelPool]);
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

export interface ExternalSeries {
  id: string;
  name: string;
  poster: string | null;
  year: number;
}

/**
 * Series clásicas que no se pueden ver en LACartoons (no están, o están sin video)
 * pero sí tienen episodios en fuentes legales propias (canales oficiales de YouTube, Pluto TV).
 * Se muestran en la biblioteca y se abren en /biblioteca/<id local>.
 */
export async function getExternalSeries(): Promise<ExternalSeries[]> {
  const catalog = (await fullCatalog()).map((series) => ({ series, key: normalize(series.name) }));
  const deadline = Date.now() + PROBE_BUDGET_MS;
  const probes: Promise<unknown>[] = [];
  after(() => Promise.allSettled(probes));

  const candidates = await Promise.all(
    Object.values(showById).map(async (show) => {
      const found = findByName([show.lacartoons, show.title, show.originalTitle].filter((n): n is string => !!n), catalog);
      if (found) {
        // Si en LACartoons se puede ver, no hace falta otra fuente.
        const series = await cachedSeries(found.id).catch(() => null);
        if (series && series.videos.length > 0 && (await isPlayableWithin(series, deadline, probes))) return null;
      }
      const numbers = await getAvailableEpisodes(show).catch(() => []);
      return numbers.length > 0 ? show : null;
    }),
  );
  const shows = candidates.filter((s): s is Show => !!s);
  const posters = await getPosters(shows).catch((): Record<string, string> => ({}));
  return shows
    .map((s) => ({ id: s.id, name: s.title, poster: posters[s.id] ?? null, year: s.year }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
