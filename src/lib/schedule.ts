import { videoSources } from "@/data/videos";
import type { Episode, Show } from "@/lib/types";

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

export function minutesNow(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}
