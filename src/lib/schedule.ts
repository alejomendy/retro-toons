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
function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local / 86_400_000);
}

/**
 * Arma la programación completa del día para un canal.
 * Es determinística: misma fecha + mismo canal = misma grilla,
 * así todos los visitantes ven "lo mismo" que está pasando.
 */
export function getDaySchedule(channelId: ChannelId, date: Date): Slot[] {
  const channel = channelById[channelId];
  const day = dayNumber(date);
  const slots: Slot[] = [];
  // Cuántas veces apareció cada serie hoy, para no repetir episodio.
  const airedToday: Record<string, number> = {};

  for (const block of channel.blocks) {
    const step = block.slotMinutes ?? 30;
    const start = toMinutes(block.start);
    const end = toMinutes(block.end);
    // La rotación arranca en distinto lugar cada día.
    let i = day % block.shows.length;

    for (let t = start; t < end; t += step, i++) {
      const show = showById[block.shows[i % block.shows.length]];
      const nth = airedToday[show.id] ?? 0;
      airedToday[show.id] = nth + 1;
      // ~6 emisiones diarias por serie: así avanza la "temporada" de reruns.
      const episodeNumber = ((day * 6 + nth) % show.episodeCount) + 1;
      slots.push({
        start: t,
        end: Math.min(t + step, end),
        block: block.name,
        show,
        episode: getEpisode(show, episodeNumber),
      });
    }
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
