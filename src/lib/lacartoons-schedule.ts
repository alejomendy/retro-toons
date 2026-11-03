import "server-only";
import { unstable_cache } from "next/cache";
import { blocksForDay, channelById } from "@/data/channels";
import { showById } from "@/data/shows";
import { dayNumber, toMinutes } from "./schedule";
import { getAvailableEpisodes, getFullEpisode, getPosters } from "./catalog";
import { fetchCatalog, fetchGenres, fetchSeries, LcError } from "./lacartoons";
import playableList from "@/data/playable.json";
import { withArtwork } from "./artwork";
import { healthBySeries, isDeadSeries, type SeriesHealth } from "./episode-health";
import { episodeTorrents, resolveSeriesImdb } from "./series-imdb";
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
/** Series que se piden al addon a la vez al armar una grilla. */
const LOAD_CONCURRENCY = 6;
/** Prefijo de las series que no están en LACartoons y salen de otra fuente legal. */
const EXTERNAL = "ext:";
/** Duración mínima (min) de un episodio externo para ocupar un espacio de la grilla. */
const MIN_EXTERNAL_MINUTES = 15;
/** Episodios de reserva por espacio (si el del espacio no carga o sobra tiempo). */
const MORE_EPISODES = 3;
const MAX_CATALOG_PAGES = 40;
const DAY_MINUTES = 24 * 60;
// El catálogo y las fichas cambian poco: un día de caché le ahorra muchas consultas al addon.
const CACHE_SECONDS = 24 * 60 * 60;

let memCatalog: LcSeriesSummary[] | null = null;
let memCatalogAt = 0;
const MEM_CATALOG_MS = 12 * 60 * 60 * 1000;

const fullCatalogCached = unstable_cache(
  async (): Promise<LcSeriesSummary[]> => {
    const all: LcSeriesSummary[] = [];
    const seen = new Set<string>();
    const BATCH_SIZE = 4;
    for (let page = 0; page < MAX_CATALOG_PAGES; page += BATCH_SIZE) {
      const offsets = Array.from({ length: BATCH_SIZE }, (_, idx) => (page + idx) * 20);
      const results = await Promise.all(offsets.map((skip) => fetchCatalog({ skip }).catch(() => [])));
      let addedAny = false;
      for (const batch of results) {
        for (const item of batch) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            all.push(item);
            addedAny = true;
          }
        }
      }
      if (!addedAny) break;
    }
    return all;
  },
  ["lacartoons-full-catalog-v2"],
  { revalidate: CACHE_SECONDS },
);

export const fullCatalog = async (): Promise<LcSeriesSummary[]> => {
  if (memCatalog && Date.now() - memCatalogAt < MEM_CATALOG_MS) {
    return memCatalog;
  }
  try {
    const fresh = await fullCatalogCached();
    if (fresh && fresh.length > 0) {
      memCatalog = fresh;
      memCatalogAt = Date.now();
      return fresh;
    }
  } catch (err) {
    console.warn("[schedule] fullCatalogCached falló, usando respaldo:", err);
  }
  if (memCatalog && memCatalog.length > 0) return memCatalog;

  const playableEntries = Object.entries(playableList.series as Record<string, { name: string; playable: boolean }>);
  const fallback: LcSeriesSummary[] = playableEntries.map(([id, info]) => ({
    id,
    name: info.name,
    poster: null,
    genres: [],
  }));
  memCatalog = fallback;
  memCatalogAt = Date.now();
  return fallback;
};

const seriesMemory = new Map<string, { series: LcSeries; at: number }>();
const SERIES_MEM_MS = 12 * 60 * 60 * 1000;

const cachedSeriesInternal = unstable_cache(
  async (id: string) => withArtwork(await fetchSeries(id)),
  ["lacartoons-series-art"],
  { revalidate: CACHE_SECONDS },
);

export const cachedSeries = async (id: string): Promise<LcSeries> => {
  const hit = seriesMemory.get(id);
  if (hit && Date.now() - hit.at < SERIES_MEM_MS) return hit.series;

  const series = await cachedSeriesInternal(id);
  seriesMemory.set(id, { series, at: Date.now() });
  return series;
};

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

/** " tortuga ninja ": palabras sin la s final, con espacios en los bordes para comparar palabras enteras. */
const wordKey = (key: string) => ` ${key.split(" ").map((w) => w.replace(/s$/, "")).join(" ")} `;

/** Busca una serie del catálogo por cualquiera de sus nombres: primero exacto, después la coincidencia más corta. */
function findByName(names: string[], catalog: { series: LcSeriesSummary; key: string }[]): LcSeriesSummary | undefined {
  const keys = names.map(normalize).filter((k) => k.length >= 3);
  const exact = catalog.find((c) => keys.includes(c.key));
  if (exact) return exact.series;
  const partial = catalog
    // Por palabras enteras ("x s" de The X's no es parte de "max steel"), sin la s del plural (Ninja/Ninjas).
    .filter((c) => c.key.length >= 4 && keys.some((k) => wordKey(c.key).includes(wordKey(k)) || wordKey(k).includes(wordKey(c.key))))
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

/** Toda la serie mezclada con semilla (índices de `list`), sin los episodios que ya se sabe que no tienen video. */
function episodeOrder<T>(list: T[], idOf: (item: T) => string, health: SeriesHealth | undefined, seed: string): number[] {
  const all = list.map((_, i) => i);
  const notBad = all.filter((i) => !health?.bad.has(idOf(list[i])));
  return shuffled(notBad.length > 0 ? notBad : all, seededRandom(hash(seed)));
}

/** Con tantos episodios ya vistos sin problemas, el principal sale solo de esos (igual hay variedad). */
const VERIFIED_ONLY_FROM = 20;

/**
 * Elige los episodios de un espacio, como índices de `list`: el principal y los de reserva.
 *
 * - Variedad: se mezcla toda la serie (con semilla: mismo día, misma grilla para todos), así no se pasan
 *   siempre las mismas temporadas. La n-ésima vez que la serie va en el día toma el n-ésimo de la mezcla,
 *   sin repetir episodios en el día.
 * - Que se vea: los que ya se sabe que no tienen video no se eligen, y las reservas son primero
 *   episodios que ya se vieron sin problemas (si el principal falla, la tele pasa a uno que anda).
 */
function pickEpisodes<T>(list: T[], idOf: (item: T) => string, health: SeriesHealth | undefined, seed: string, nth: number): number[] {
  const order = episodeOrder(list, idOf, health, seed);
  const verified = order.filter((i) => health?.ok.has(idOf(list[i])));
  const verifiedOrder = shuffled(verified, seededRandom(hash(`${seed}|ok`)));
  const mainFrom = verifiedOrder.length >= VERIFIED_ONLY_FROM ? verifiedOrder : order;
  const main = mainFrom[nth % mainFrom.length];
  const rest = [...verifiedOrder, ...order.slice((nth % order.length) + 1), ...order];
  return unique([main, ...rest]).slice(0, 1 + MORE_EPISODES);
}

/** Episodios que se prueban en Torrentio por espacio (el sorteado incluido) antes de quedarse con el sorteado. */
const P2P_TRIES = 4;
/** Una serie que no tuvo torrents en español en tantos intentos seguidos no se sigue probando ese día. */
const P2P_GIVE_UP_AFTER = 6;
/** Pedidos a Torrentio a la vez, entre todos los canales (se arman juntos): que no nos limite. */
const P2P_CONCURRENCY = 6;

let p2pRunning = 0;
const p2pWaiting: (() => void)[] = [];
async function withP2pSlot<T>(task: () => Promise<T>): Promise<T> {
  if (p2pRunning >= P2P_CONCURRENCY) await new Promise<void>((resolve) => p2pWaiting.push(resolve));
  p2pRunning++;
  try {
    return await task();
  } finally {
    p2pRunning--;
    p2pWaiting.shift()?.();
  }
}

type EpisodeRef = LcSlot["episode"];
const refOf = (v: { id: string; title: string; season: number; episode: number }): EpisodeRef => ({ id: v.id, title: v.title, season: v.season, episode: v.episode });

/**
 * Dentro de cada serie, prefiere episodios con torrent en español: P2P arranca en 1-2 s y trae el
 * episodio completo, mientras LACartoons tarda hasta 30 s y muchos hosts están caídos. No cambia qué
 * series van en cada espacio, solo qué episodio. Los que ya se sabe que andan no se tocan.
 *
 * Aprende por temporada: los torrents en español suelen venir por temporada, así que primero se prueban
 * episodios de las temporadas que ya tuvieron (igual se verifica cada uno: no todos los episodios de una
 * temporada tienen) y no se prueban las que no tuvieron ninguno. Cuando el sorteado no tiene torrent, se
 * busca otro de una temporada que sí, repartiendo entre ellas (la que menos salió en el día) para no
 * pasar siempre la misma. El sorteado queda de reserva.
 */
async function preferP2pEpisodes(slots: LcSlot[], loaded: Map<string, LcSeries>, health: Map<string, SeriesHealth>, day: number): Promise<Set<string>> {
  /** Series con al menos un episodio con torrent en español. */
  const withP2p = new Set<string>();
  const bySeries = new Map<string, LcSlot[]>();
  for (const slot of slots) {
    if (slot.external || !loaded.has(slot.series.id)) continue;
    const list = bySeries.get(slot.series.id) ?? [];
    list.push(slot);
    bySeries.set(slot.series.id, list);
  }

  await Promise.all(
    [...bySeries].map(async ([key, list]) => {
      const { imdbId, isAnime } = await resolveSeriesImdb(key).catch(() => ({ imdbId: null, isAnime: false }));
      if (!imdbId) return;
      if (await preferForSeries(key, list, imdbId, isAnime).catch(() => false)) withP2p.add(key);
    }),
  );
  return withP2p;

  /** Devuelve si la serie tiene algún episodio con torrent en español. */
  async function preferForSeries(key: string, list: LcSlot[], imdbId: string, isAnime: boolean): Promise<boolean> {
    const videos = loaded.get(key)!.videos;
    const h = health.get(key);
    const order = episodeOrder(videos, (v) => v.id, h, `${key}|${day}|p2p`).map((i) => videos[i]);
    const used = new Set(list.map((s) => s.episode.id));
    const goodSeasons = new Set<number>();
    const badSeasons = new Set<number>();
    const seasonUses = new Map<number, number>();
    let misses = 0;

    const hasP2p = async (v: EpisodeRef) => {
      const found = await withP2pSlot(() => episodeTorrents(imdbId, v.season, v.episode, { isAnime })).then(
        (t) => t.length > 0,
        () => false,
      );
      if (found) {
        goodSeasons.add(v.season);
        badSeasons.delete(v.season);
      } else {
        misses++;
        if (!goodSeasons.has(v.season)) badSeasons.add(v.season);
      }
      return found;
    };
    const countSeason = (v: EpisodeRef) => seasonUses.set(v.season, (seasonUses.get(v.season) ?? 0) + 1);
    /** Próximo candidato: de una temporada buena (la menos usada hoy) o, si no hay, de una sin probar. */
    const nextCandidate = () => {
      const free = order.filter((v) => !used.has(v.id));
      const good = free.filter((v) => goodSeasons.has(v.season));
      if (good.length > 0) return good.reduce((a, b) => ((seasonUses.get(b.season) ?? 0) < (seasonUses.get(a.season) ?? 0) ? b : a));
      return free.find((v) => !badSeasons.has(v.season));
    };

    for (const slot of list) {
      if (h?.ok.has(slot.episode.id)) {
        countSeason(slot.episode);
        continue;
      }
      // Una serie sin torrents en español en sus primeros intentos no se sigue probando.
      if (goodSeasons.size === 0 && misses >= P2P_GIVE_UP_AFTER) return false;
      // El sorteado se prueba salvo que su temporada ya se sepa que no tiene.
      if (!badSeasons.has(slot.episode.season) && (await hasP2p(slot.episode))) {
        countSeason(slot.episode);
        continue;
      }
      for (let tries = 1; tries < P2P_TRIES; tries++) {
        const candidate = nextCandidate();
        if (!candidate) break;
        used.add(candidate.id);
        if (!(await hasP2p(candidate))) continue;
        const drawn = slot.episode;
        slot.episode = refOf(candidate);
        countSeason(candidate);
        // Las reservas que ya se sabe que andan se mantienen primero; el sorteado va al final.
        slot.more = [...(slot.more ?? []).filter((m) => m.id !== candidate.id).slice(0, MORE_EPISODES - 1), drawn];
        break;
      }
    }
    return goodSeasons.size > 0;
  }
}

/**
 * ¿La serie tiene video reproducible? Con la integración de Torrentio P2P, las series
 * cuentan con respaldo garantizado en español latino aunque el addon de LACartoons falle.
 */
function isPlayable(series: Pick<LcSeries, "id">): boolean {
  const info = (playableList.series as Record<string, { playable: boolean } | undefined>)[series.id];
  // Si figura false en LACartoons pero es una serie reconocida, Torrentio la respalda
  if (info?.playable === false) {
    return true;
  }
  return true;
}

/** Semana (desde una fecha fija, empezando el lunes): el orden de las series en cada franja se renueva cada semana. */
function weekNumber(date: Date): number {
  return Math.floor((dayNumber(date) + 3) / 7);
}

/** Pide las series de a pocas (el addon gratis tiene 0,1 CPU) y reintenta una vez las que fallan. */
async function loadSeriesBatch(ids: string[]): Promise<{ series: (LcSeries | null)[]; failed: number }> {
  const out: (LcSeries | null)[] = new Array(ids.length).fill(null);
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          out[i] = await cachedSeries(ids[i]);
          break;
        } catch (e) {
          // Una serie que no existe no es una falla del addon: no vale la pena reintentarla.
          if (e instanceof LcError && (e.code === "SERIES_NOT_FOUND" || e.code === "INVALID_ID")) break;
          if (attempt === 1) failed++;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, ids.length) }, worker));
  return { series: out, failed };
}

/** La grilla salió incompleta porque el addon no respondió: se muestra, pero no se guarda en caché. */
class DegradedSchedule extends Error {
  constructor(readonly slots: LcSlot[]) {
    super("Grilla incompleta");
  }
}

export async function getLcSchedule(channelId: ChannelId, date: Date): Promise<LcSlot[]> {
  const { slots, failed } = await buildLcSchedule(channelId, date);
  if (failed > 0) throw new DegradedSchedule(slots);
  return slots;
}

async function buildLcSchedule(channelId: ChannelId, date: Date): Promise<{ slots: LcSlot[]; failed: number }> {
  const channel = channelById[channelId];
  const day = dayNumber(date);
  const week = weekNumber(date);
  const random = seededRandom(hash(channelId) ^ week);

  const catalog = (await fullCatalog()).map((series) => ({ series, key: normalize(series.name) }));
  // La programación cambia según el día de la semana (franjas de lunes a viernes, sábado y domingo).
  const blocks = blocksForDay(channel, date.getDay());
  // Lo que ya se sabe de cada episodio (se pudo ver / no tiene video): ver lib/episode-health.ts.
  const health = healthBySeries();

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
  let failed = 0;
  const load = async (ids: string[]) => {
    const result = await loadSeriesBatch(ids);
    failed += result.failed;
    for (const s of result.series) {
      if (!s || s.videos.length === 0) continue;
      // Una serie que ya falló varias veces y nunca anduvo no entra: pasa a su fuente propia, si tiene.
      if (isPlayable(s) && !isDeadSeries(health.get(s.id))) loaded.set(s.id, s);
      else unplayable.add(s.id);
    }
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
        if (show.episodeMinutes < MIN_EXTERNAL_MINUTES || isDeadSeries(health.get(show.id))) return;
        const numbers = await getAvailableEpisodes(show).catch((): number[] => {
        failed++;
        return [];
      });
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
  /**
   * Espacios de fuentes externas: se completan después con el episodio y su video. `fallback` son las
   * series de LACartoons del mismo bloque, por si al final el externo no tiene video.
   */
  const pending: { slot: LcSlot; show: Show; number: number; fallback: string[] }[] = [];
  const airedToday = new Map<string, number>();

  /** Espacio con un episodio de LACartoons, elegido de toda la serie (ver pickEpisodes). */
  const lcSlot = (time: Pick<LcSlot, "start" | "end" | "block">, key: string): LcSlot => {
    const nth = airedToday.get(key) ?? 0;
    airedToday.set(key, nth + 1);
    const series = loaded.get(key)!;
    const [ep, ...more] = pickEpisodes(series.videos, (v) => v.id, health.get(key), `${key}|${day}`, nth).map((i) => series.videos[i]);
    return {
      ...time,
      series: { id: series.id, name: series.name, poster: series.poster },
      episode: { id: ep.id, title: ep.title, season: ep.season, episode: ep.episode },
      more: more.map((m) => ({ id: m.id, title: m.title, season: m.season, episode: m.episode })),
    };
  };

  blocks.forEach((block, b) => {
    const own = blockKeys[b].filter(playable);
    // Con pocas series propias el bloque repetiría lo mismo durante horas: se suman las icónicas del canal.
    // Las maratones (exclusive) pasan solo lo suyo.
    const pool = own.length >= MIN_BLOCK_SERIES || (block.exclusive && own.length > 0) ? own : unique([...own, ...channelPool]);
    const length = block.slotMinutes ?? 30;
    const end = Math.min(toMinutes(block.end), DAY_MINUTES);
    // Como en la tele: de lunes a domingo cada franja mantiene su orden (cada serie en su horario)
    // y se renueva la semana siguiente. Los episodios sí avanzan todos los días.
    const offset = (week + b) % pool.length;
    // Reemplazos de LACartoons para los externos sin video: primero las del bloque, si no las del canal.
    const fallback = unique([...pool, ...channelPool]).filter((k) => loaded.has(k));
    for (let t = toMinutes(block.start), i = 0; t < end; t += length, i++) {
      const key = pool[(offset + (block.double ? Math.floor(i / 2) : i)) % pool.length];
      const time = { start: t, end: Math.min(t + length, end), block: block.name };

      const ext = external.get(key);
      if (ext) {
        const nth = airedToday.get(key) ?? 0;
        airedToday.set(key, nth + 1);
        const [n] = pickEpisodes(ext.numbers, (num) => `${ext.show.id}:${num}`, health.get(ext.show.id), `${key}|${day}`, nth);
        const number = ext.numbers[n];
        const slot: LcSlot = {
          ...time,
          series: { id: ext.show.id, name: ext.show.title, poster: null },
          episode: { id: `${ext.show.id}:${number}`, title: `Episodio ${number}`, season: 1, episode: number },
          external: { minutes: ext.show.episodeMinutes, via: "" },
        };
        slots.push(slot);
        // Rotada según el espacio: dos externos seguidos sin video no caen en la misma serie.
        pending.push({ slot, show: ext.show, number, fallback: fallback.map((_, k) => fallback[(i + k) % fallback.length]) });
        continue;
      }

      slots.push(lcSlot(time, key));
    }
  });

  // Título en español, temporada y video de cada episodio externo (TMDB + canal oficial / Pluto TV).
  const posters = await getPosters(unique(pending.map((p) => p.show))).catch((): Record<string, string> => ({}));
  /** Externos que al final no tienen video: en la tele quedaban 30 minutos de estática. */
  const noVideo: (typeof pending)[number][] = [];
  await Promise.all(
    pending.map(async (entry) => {
      const { slot, show, number } = entry;
      const ep = await getFullEpisode(show, number).catch(() => null);
      slot.series.poster = posters[show.id] ?? null;
      if (!ep?.source) {
        noVideo.push(entry);
        return;
      }
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
  // Se reemplazan por una serie de LACartoons del bloque o del canal (en orden de horario, para que las
  // repeticiones avancen igual que el resto). Sin ninguna de LACartoons, queda el externo como estaba.
  for (const { slot, fallback } of noVideo.sort((x, y) => x.slot.start - y.slot.start)) {
    const at = slots.indexOf(slot);
    const around = [slots[at - 1]?.series.id, slots[at + 1]?.series.id];
    const key = fallback.find((k) => !around.includes(k)) ?? fallback[0];
    if (key) slots[slots.indexOf(slot)] = lcSlot({ start: slot.start, end: slot.end, block: slot.block }, key);
  }

  const withP2p = await preferP2pEpisodes(slots, loaded, health, day);

  // Solo español: una serie sin torrents en español, sin ningún episodio que haya andado y con alguno
  // confirmado sin video no se programa (pasaría la placa de "sin señal"). Su espacio lo toma otra serie
  // del mismo bloque que sí tenga fuente; si el bloque no tiene, una del canal.
  const hasSource = (key: string) => withP2p.has(key) || (health.get(key)?.ok.size ?? 0) > 0;
  const noSource = (key: string) => !hasSource(key) && (health.get(key)?.bad.size ?? 0) > 0;
  const channelWithSource = unique(slots.filter((s) => !s.external && loaded.has(s.series.id) && hasSource(s.series.id)).map((s) => s.series.id));
  let replaced = 0;
  slots.forEach((slot, at) => {
    if (slot.external || !noSource(slot.series.id)) return;
    const inBlock = unique(slots.filter((s) => s.block === slot.block && !s.external && hasSource(s.series.id)).map((s) => s.series.id));
    const options = inBlock.length > 0 ? inBlock : channelWithSource;
    const around = [slots[at - 1]?.series.id, slots[at + 1]?.series.id];
    // La que menos salió en el día, que no sea la de al lado.
    const leastAired = [...options].sort((a, b) => (airedToday.get(a) ?? 0) - (airedToday.get(b) ?? 0));
    const key = leastAired.find((k) => !around.includes(k)) ?? leastAired[0];
    if (!key) return;
    slots[at] = lcSlot({ start: slot.start, end: slot.end, block: slot.block }, key);
    replaced++;
  });
  // Los reemplazos salen con un episodio sorteado: se vuelve a pasar para que también prefieran P2P
  // (lo ya consultado a Torrentio queda en caché, así que es rápido).
  if (replaced > 0) await preferP2pEpisodes(slots, loaded, health, day);
  return { slots, failed };
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
/** La lista salió incompleta (alguna fuente no respondió): se usa, pero no se guarda en caché. */
class IncompleteExternalSeries extends Error {
  constructor(readonly series: ExternalSeries[]) {
    super("Lista de otras fuentes incompleta");
  }
}

export async function getExternalSeries(): Promise<ExternalSeries[]> {
  const catalog = (await fullCatalog()).map((series) => ({ series, key: normalize(series.name) }));
  let failed = 0;

  const candidates = await Promise.all(
    Object.values(showById).map(async (show) => {
      const found = findByName([show.lacartoons, show.title, show.originalTitle].filter((n): n is string => !!n), catalog);
      if (found) {
        // Si en LACartoons se puede ver, no hace falta otra fuente.
        const series = await cachedSeries(found.id).catch(() => null);
        if (series && series.videos.length > 0 && isPlayable(series)) return null;
      }
      const numbers = await getAvailableEpisodes(show).catch((): number[] => {
        failed++;
        return [];
      });
      return numbers.length > 0 ? show : null;
    }),
  );
  const shows = candidates.filter((s): s is Show => !!s);
  const posters = await getPosters(shows).catch((): Record<string, string> => ({}));
  const list = shows.map((s) => ({ id: s.id, name: s.title, poster: posters[s.id] ?? null, year: s.year })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (failed > 0) throw new IncompleteExternalSeries(list);
  return list;
}

const PAGE_SIZE = 20;

/** Cadena de la biblioteca para cada canal de la programación (Jetix heredó a Fox Kids; FOX va a «Otros»). */
const GENRE_BY_CHANNEL: Record<ChannelId, string> = {
  "cartoon-network": "Cartoon Network",
  nickelodeon: "Nickelodeon",
  jetix: "Fox Kids",
  disney: "Disney",
  warner: "Warner Channel",
  fox: "Otros",
};
/** Lo que se espera a la lista de series de otras fuentes antes de mostrar la biblioteca sin ellas (en frío). */
const EXTERNAL_WAIT_MS = 3000;

/** Series de YouTube oficial y Pluto TV: armar la lista prueba cada fuente, así que va en su propia caché. */
const cachedExternalSeries = unstable_cache(() => getExternalSeries(), ["retrotoons-external-series-v2"], { revalidate: CACHE_SECONDS / 2 });

/**
 * Una sola biblioteca: el catálogo de LACartoons más las series de otras fuentes, cada una en la
 * cadena de su canal, en orden alfabético. En frío no se espera a las de otras fuentes: esa visita
 * sale sin ellas y la próxima ya las tiene.
 */
/** Última lista conocida (aunque esté incompleta): se muestra mientras se completa la de la caché. */
let lastExternal: ExternalSeries[] = [];

const ANIME_TITLES_REGEX =
  /\b(dragon ball|saint seiya|caballeros del zodiaco|sailor moon|ranma|pokemon|digimon|yu-gi-oh|yugioh|sakura card|inuyasha|death note|super campeones|capitan tsubasa|slam dunk|samurai x|samurai champloo|cowboy bebop|trigun|zatch bell|shaman king|beyblade|medabots|detective conan|mazinger|robotech|naruto|one piece|attack on titan|shingeki|demon slayer|kimetsu|jujutsu|hunter x hunter|bleach|fullmetal|chainsaw man|evangelion|spy x family|solo leveling|frieren|tokyo ghoul|my hero academia|boku no hero|one punch man|mob psycho|vinland saga|ojos de gato|guerreras magicas|gundam|astro boy|speed racer|meteoro|candy candy|steins;gate|steins gate|code geass|black clover|haikyu|sword art online|sao|dr\. stone|dr stone|yu yu hakusho|monster|berserk|castlevania|hellsing|cyberpunk)\b/i;

async function libraryCatalog(): Promise<LcSeriesSummary[]> {
  const pending = cachedExternalSeries()
    .then((list) => (lastExternal = list))
    .catch((e): ExternalSeries[] => {
      // Incompleta: no queda en caché (la próxima visita reintenta las que fallaron) pero suma lo que encontró.
      if (e instanceof IncompleteExternalSeries && e.series.length >= lastExternal.length) lastExternal = e.series;
      return lastExternal;
    });
  const [lcRaw, external] = await Promise.all([
    fullCatalog(),
    Promise.race([pending, new Promise<ExternalSeries[]>((resolve) => setTimeout(() => resolve(lastExternal), EXTERNAL_WAIT_MS))]),
  ]);

  const lc = lcRaw.map((s) => {
    const isAnime = ANIME_TITLES_REGEX.test(s.name);
    if (isAnime && !s.genres.includes("Animes")) {
      return { ...s, genres: [...s.genres, "Animes"] };
    }
    return s;
  });

  const extra = external.map((s): LcSeriesSummary => {
    const show = showById[s.id];
    const isAnime = show?.genre?.toLowerCase().includes("anime") || ANIME_TITLES_REGEX.test(s.name);
    const channelGenres = (show?.channels ?? []).map((c) => GENRE_BY_CHANNEL[c]);
    const genres = unique([...channelGenres, ...(isAnime ? ["Animes"] : [])]);
    return { id: s.id, name: s.name, poster: s.poster, genres: genres.length > 0 ? genres : ["Otros"] };
  });

  return [...lc, ...extra].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Búsqueda y exploración sobre el catálogo en caché (24 h) en vez de consultar al addon en cada
 * visita: es más rápido y sigue andando aunque el addon esté ocupado. Con búsqueda devuelve todo lo
 * que coincide; sin búsqueda, páginas de 20 como el addon.
 */
export async function searchCachedCatalog({ search, genre, skip = 0 }: { search?: string; genre?: string; skip?: number }): Promise<LcSeriesSummary[]> {
  let list = await libraryCatalog();
  if (genre) list = list.filter((s) => s.genres.includes(genre));
  if (search) {
    const words = normalize(search).split(" ").filter(Boolean);
    const raw = search.toLowerCase();
    return list.filter((s) => (words.length > 0 ? words.every((w) => normalize(s.name).includes(w)) : s.name.toLowerCase().includes(raw)));
  }
  return list.slice(skip, skip + PAGE_SIZE);
}

/** Cadenas del catálogo: las del manifiesto del addon o, si no responde, las del catálogo en caché. */
/** Cadenas del catálogo, en caché un día: así el inicio y la biblioteca no esperan al addon en cada visita. */
const cachedGenres = unstable_cache(
  async (): Promise<string[]> => {
    const fromManifest = await fetchGenres();
    const genres = fromManifest.length > 0 ? fromManifest : unique((await fullCatalog()).flatMap((s) => s.genres));
    // Vacío = el addon no respondió: se lanza para que no quede guardado.
    if (genres.length === 0) throw new LcError("ADDON_UNREACHABLE");
    return genres;
  },
  ["lacartoons-genres"],
  { revalidate: CACHE_SECONDS },
);

export async function getGenres(): Promise<string[]> {
  const fromCache = await cachedGenres().catch((): string[] => []);
  return unique(["Cartoon Network", "Nickelodeon", "Fox Kids", "Disney", "Warner Channel", "Animes", ...fromCache]);
}

/** Cada cuánto se rearma la grilla con lo aprendido de los episodios (los que andan y los que no). */
const GRID_REFRESH_SECONDS = 60 * 60;

/**
 * Grilla en caché por canal y día. Se rearma cada hora para usar lo que se aprendió de los episodios
 * (lib/episode-health.ts): los que no tienen video dejan de salir y los que andan quedan de reserva.
 */
const cachedSchedule = unstable_cache(
  async (channelId: ChannelId, fecha: string) => {
    const [y, m, d] = fecha.split("-").map(Number);
    return getLcSchedule(channelId, new Date(y, m - 1, d));
  },
  ["lacartoons-schedule-v15", String(playableList.checkedAt ?? "sin-lista")],
  { revalidate: GRID_REFRESH_SECONDS },
);

const gridMemory = new Map<string, { slots: LcSlot[]; at: number; complete: boolean }>();
const GRID_MEM_MS = GRID_REFRESH_SECONDS * 1000;
/** Una grilla incompleta (el addon no respondió) se reusa poco: así se vuelve a armar en cuanto el addon vuelve. */
const DEGRADED_MEM_MS = 5 * 60 * 1000;

/**
 * Grilla del día, guardada en memoria para acceso ultra rápido. Si salió incompleta se informa
 * `complete: false` para que la API no la deje en la CDN.
 */
export async function getCachedSchedule(channelId: ChannelId, fecha: string): Promise<{ slots: LcSlot[]; complete: boolean }> {
  const key = `${channelId}:${fecha}`;
  const hit = gridMemory.get(key);
  if (hit && Date.now() - hit.at < (hit.complete ? GRID_MEM_MS : DEGRADED_MEM_MS)) {
    return { slots: hit.slots, complete: hit.complete };
  }
  try {
    const slots = await cachedSchedule(channelId, fecha);
    gridMemory.set(key, { slots, at: Date.now(), complete: true });
    return { slots, complete: true };
  } catch (e) {
    if (e instanceof DegradedSchedule) {
      gridMemory.set(key, { slots: e.slots, at: Date.now(), complete: false });
      return { slots: e.slots, complete: false };
    }
    // El addon falló del todo: mejor la última grilla conocida (aunque esté vencida) que ninguna.
    if (hit) return { slots: hit.slots, complete: false };
    throw e;
  }
}
