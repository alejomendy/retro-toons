import { channelById } from "@/data/channels";
import { showById } from "@/data/shows";
import { videoSources } from "@/data/videos";
import type { ChannelId, Episode, Show, Slot } from "@/lib/types";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getEpisode(show: Show, number: number): Episode {
  return {
    showId: show.id,
    number,
    title: show.episodeTitles?.[number - 1] ?? `Episodio ${number}`,
    minutes: show.episodeMinutes,
    source: videoSources[`${show.id}:${number}`],
  };
}

export function getEpisodes(show: Show): Episode[] {
  return Array.from({ length: show.episodeCount }, (_, i) => getEpisode(show, i + 1));
}

/** Días desde una fecha fija: hace avanzar los episodios día a día. */
export function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local / 86_400_000);
}

const DAY_MINUTES = 24 * 60;
/** Tanda entre programas (minutos). */
export const TANDA_MINUTES = 1;

/** Mínimo de series distintas que tiene que tener la grilla de un canal. */
const MIN_SHOWS = 5;

/** Series que pueden aparecer en un canal: las de sus bloques y las que se emitieron en él. */
export function scheduleCandidates(channelId: ChannelId): string[] {
  const fromBlocks = channelById[channelId].blocks.flatMap((b) => b.shows ?? []);
  const aired = Object.values(showById).filter((s) => s.channels.includes(channelId)).map((s) => s.id);
  return [...new Set([...fromBlocks, ...aired])];
}

/**
 * Arma la programación completa del día para un canal.
 * Es determinística: misma fecha + mismo canal = misma grilla,
 * así todos los visitantes ven "lo mismo" que está pasando.
 *
 * Con `available` (episodios que se pueden ver, por serie) solo programa esos:
 * cada bloque pasa sus series que tengan episodios; si no le queda ninguna, las
 * del resto del canal. Si el canal no tiene nada disponible, se arma como siempre.
 */
export function getDaySchedule(channelId: ChannelId, date: Date, available?: Record<string, number[]>): Slot[] {
  const channel = channelById[channelId];
  const day = dayNumber(date);
  const slots: Slot[] = [];
  // Cuántas veces apareció cada serie hoy, para no repetir episodio.
  const airedToday: Record<string, number> = {};
  const playable = (id: string) => (available?.[id]?.length ?? 0) > 0;
  const candidates = scheduleCandidates(channelId);
  const own = candidates.filter(playable);
  // Con pocas series propias disponibles, el canal se completa con otras del catálogo (rotan cada día).
  const others = Object.keys(available ?? {}).filter((id) => playable(id) && !own.includes(id));
  const rotated = others.map((_, k) => others[(day + k) % others.length]);
  const channelPool = [...own, ...rotated.slice(0, Math.max(0, MIN_SHOWS - own.length))];
  const filter = !!available && channelPool.length > 0;

  const pools = channel.blocks.map((block) => {
    const shows = block.shows ?? [];
    const inBlock = filter ? shows.filter(playable) : shows;
    // Un bloque con una sola serie disponible repetiría lo mismo horas: mejor todo el canal.
    return !filter || new Set(inBlock).size >= 2 ? inBlock : channelPool;
  });
  // La rotación de cada bloque arranca en distinto lugar cada día.
  const next = pools.map((pool) => day % pool.length);

  // Con episodios disponibles, cada espacio dura lo que el episodio más una tanda corta
  // y el siguiente arranca enseguida (como en la tele). Sin datos, espacios fijos por bloque.
  for (let t = 0; t < DAY_MINUTES; ) {
    const b = Math.max(0, channel.blocks.findIndex((x) => t >= toMinutes(x.start) && t < toMinutes(x.end)));
    const block = channel.blocks[b];
    const pool = pools[b];
    const show = showById[pool[next[b]++ % pool.length]];
    const nth = airedToday[show.id] ?? 0;
    airedToday[show.id] = nth + 1;
    // ~6 emisiones diarias por serie: así avanza la "temporada" de reruns.
    const list = filter ? available![show.id] : undefined;
    const episodeNumber = list ? list[(day * 6 + nth) % list.length] : ((day * 6 + nth) % show.episodeCount) + 1;
    const length = filter ? show.episodeMinutes + TANDA_MINUTES : (block.slotMinutes ?? 30);
    slots.push({
      start: t,
      end: Math.min(t + length, DAY_MINUTES),
      block: block.name,
      show,
      episode: getEpisode(show, episodeNumber),
      guest: filter && !candidates.includes(show.id),
    });
    t += length;
  }
  return slots;
}

export function minutesNow(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

export function findCurrentSlot(slots: Slot[], now: Date): Slot | undefined {
  const m = minutesNow(now);
  return slots.find((s) => m >= s.start && m < s.end);
}
