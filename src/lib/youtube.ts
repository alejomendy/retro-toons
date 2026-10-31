import "server-only";
import { mentionsEpisode, mentionsSeries } from "@/lib/text";
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

async function search(q: string, channels: string[], seriesNames: string[], episodeNames: string[]): Promise<string | null> {
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
      (i) => (!channels.length || channels.includes(i.snippet.channelId)) && mentionsSeries(i.snippet.title, seriesNames) && mentionsEpisode(i.snippet.title, episodeNames),
    );
    return hit?.id.videoId ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca un video embebible cuyo título mencione la serie y el episodio.
 * Devuelve undefined si no hay key o no encuentra nada.
 */
export async function findYoutubeVideo(query: string, seriesNames: string[], episodeNames: string[]): Promise<VideoSource | undefined> {
  if (!youtubeEnabled()) return undefined;
  const id = await search(query, allowedChannels(), seriesNames, episodeNames);
  return id ? { type: "youtube", id } : undefined;
}

export interface AuthorizedYoutubeEpisode {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
}

/**
 * Busca un episodio únicamente en canales incluidos explícitamente en
 * YOUTUBE_CHANNEL_IDS. Así la búsqueda no se convierte en un buscador abierto
 * de copias subidas por terceros. La API de YouTube no certifica el audio:
 * el idioma mostrado siempre se etiqueta como no verificado.
 */
export async function findAuthorizedYoutubeEpisode(input: {
  series: string;
  originalTitle?: string | null;
  episodeTitle?: string | null;
  season: number;
  episode: number;
}): Promise<AuthorizedYoutubeEpisode | null> {
  if (!youtubeEnabled()) return null;
  const channels = allowedChannels();
  if (channels.length === 0) return null;

  const aliases = [input.series, input.originalTitle].filter((value): value is string => Boolean(value?.trim()));
  const episodeNames = [input.episodeTitle].filter((value): value is string => Boolean(value?.trim()));
  const query = `${aliases.join(" ")} ${input.episodeTitle ?? ""} S${String(input.season).padStart(2, "0")}E${String(input.episode).padStart(2, "0")} español latino`.trim();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "strict",
    maxResults: "25",
    relevanceLanguage: "es",
    regionCode: process.env.YOUTUBE_REGION || "AR",
    q: query,
    key: process.env.YOUTUBE_API_KEY!,
  });

  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      next: { revalidate: ONE_WEEK },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      items?: Array<{ id?: { videoId?: string }; snippet?: { channelId?: string; channelTitle?: string; title?: string } }>;
    };
    const hit = (data.items ?? []).find((item) => {
      const videoId = item.id?.videoId;
      const channelId = item.snippet?.channelId;
      const title = item.snippet?.title ?? "";
      if (!videoId || !channelId || !channels.includes(channelId)) return false;
      const seriesMatch = aliases.some((name) => mentionsSeries(title, [name]));
      const episodeMatch = episodeNames.length === 0 || mentionsEpisode(title, episodeNames);
      const codeMatch = new RegExp(`(?:s|t)0*${input.season}\\s*e0*${input.episode}|${input.season}x0*${input.episode}`, "i").test(title);
      return seriesMatch && (episodeMatch || codeMatch);
    });
    if (!hit?.id?.videoId || !hit.snippet?.channelId) return null;
    return {
      id: hit.id.videoId,
      title: hit.snippet.title ?? "Episodio",
      channelTitle: hit.snippet.channelTitle ?? "Canal autorizado configurado",
      channelId: hit.snippet.channelId,
    };
  } catch {
    return null;
  }
}
