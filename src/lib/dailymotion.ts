import "server-only";
import { mentionsEpisode, mentionsSeries } from "@/lib/text";
import type { VideoSource } from "@/lib/types";

/**
 * Búsqueda de videos en Dailymotion (https://developers.dailymotion.com/api/) — sin API key.
 *
 * Variables de entorno:
 *   DAILYMOTION_ENABLED  — "true" para activarla.
 *   DAILYMOTION_OWNERS   — opcional, IDs de usuarios permitidos (separados por coma).
 *   NEXT_PUBLIC_DAILYMOTION_PLAYER_ID — ID de un player creado en https://www.dailymotion.com/partner
 *                          (gratis). Sin él, el reproductor genérico puede responder "Forbidden".
 *
 * Solo acepta videos embebibles, en español, de al menos 5 minutos (para
 * descartar clips sueltos) y cuyo título mencione la serie y el episodio.
 */
const ONE_WEEK = 60 * 60 * 24 * 7;
const MIN_SECONDS = 5 * 60;

export function dailymotionEnabled(): boolean {
  return process.env.DAILYMOTION_ENABLED === "true";
}

interface DmVideo {
  id: string;
  title: string;
  duration: number;
  allow_embed: boolean;
  "owner.id": string;
}

export async function findDailymotionVideo(query: string, seriesNames: string[], episodeNames: string[]): Promise<VideoSource | undefined> {
  if (!dailymotionEnabled()) return undefined;
  const owners = (process.env.DAILYMOTION_OWNERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const params = new URLSearchParams({
    search: query,
    languages: "es",
    fields: "id,title,duration,allow_embed,owner.id",
    sort: "relevance",
    limit: "20",
  });
  if (owners.length) params.set("owners", owners.join(","));

  try {
    const res = await fetch(`https://api.dailymotion.com/videos?${params}`, {
      next: { revalidate: ONE_WEEK },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return undefined;
    const { list } = (await res.json()) as { list: DmVideo[] };
    const hit = list.find((v) => v.allow_embed && v.duration >= MIN_SECONDS && mentionsSeries(v.title, seriesNames) && mentionsEpisode(v.title, episodeNames));
    return hit ? { type: "dailymotion", id: hit.id } : undefined;
  } catch {
    return undefined;
  }
}
