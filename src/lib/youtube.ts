import "server-only";
import { mentionsSeries } from "@/lib/text";
import type { VideoSource } from "@/lib/types";

/**
 * Búsqueda de videos con YouTube Data API v3.
 * https://developers.google.com/youtube/v3/docs/search/list
 *
 * Variables de entorno:
 *   YOUTUBE_API_KEY      — obligatoria para activar la búsqueda.
 *   YOUTUBE_CHANNEL_IDS  — opcional, IDs de canales separados por coma (ej. los
 *                          canales oficiales). Si se define, solo se buscan
 *                          videos dentro de esos canales.
 *
 * Cada búsqueda cuesta 100 unidades de cuota (10.000 diarias gratis ≈ 100
 * búsquedas), así que cacheamos cada resultado 7 días. Con lista de canales
 * se hace igual una sola búsqueda y se filtran los resultados.
 */
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const ONE_WEEK = 60 * 60 * 24 * 7;

export function youtubeEnabled(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

function allowedChannels(): string[] {
  return (process.env.YOUTUBE_CHANNEL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface SearchItem {
  id: { videoId?: string };
  snippet: { channelId: string; title: string };
}

async function search(q: string, channels: string[], seriesNames: string[]): Promise<string | null> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    safeSearch: "strict",
    // Pedir varios cuesta lo mismo (100 unidades) y permite filtrar.
    maxResults: "25",
    // Priorizar resultados en español para Latinoamérica
    relevanceLanguage: "es",
    regionCode: process.env.YOUTUBE_REGION || "MX",
    q,
    key: process.env.YOUTUBE_API_KEY!,
  });

  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      next: { revalidate: ONE_WEEK },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn(`[youtube] ${res.status} buscando "${q}"`);
      return null;
    }
    const data = (await res.json()) as { items?: SearchItem[] };
    const items = data.items ?? [];
    const hit = items.find(
      (i) => (!channels.length || channels.includes(i.snippet.channelId)) && mentionsSeries(i.snippet.title, seriesNames),
    );
    return hit?.id.videoId ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca un video embebible para el episodio cuyo título mencione la serie.
 * Devuelve undefined si no hay key o no encuentra nada.
 */
export async function findYoutubeVideo(query: string, seriesNames: string[]): Promise<VideoSource | undefined> {
  if (!youtubeEnabled()) return undefined;
  const id = await search(query, allowedChannels(), seriesNames);
  return id ? { type: "youtube", id } : undefined;
}
