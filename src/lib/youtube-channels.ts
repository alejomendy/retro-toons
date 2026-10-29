import "server-only";
import { unstable_cache } from "next/cache";
import { mentionsEpisode, normalize } from "@/lib/text";
import type { VideoSource } from "@/lib/types";

/**
 * Episodios completos desde canales OFICIALES de YouTube (configurados por serie
 * en shows.ts con `youtubeChannels`).
 *
 * En vez de buscar (100 unidades de cuota por búsqueda), se lee la lista de
 * subidas del canal: playlistItems + videos cuestan 1 unidad cada 50 videos,
 * y el resultado se guarda un día.
 */
const API = "https://www.googleapis.com/youtube/v3";
const ONE_DAY = 60 * 60 * 24;
/** Tope de páginas de 50 videos por canal (3.000 videos). */
const MAX_PAGES = 60;

export interface ChannelVideo {
  id: string;
  title: string;
  minutes: number;
}

function isoMinutes(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY! });
  const res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`[youtube] ${res.status} en ${path}`);
  return (await res.json()) as T;
}

async function loadChannel(channelId: string): Promise<ChannelVideo[]> {
  // La lista de subidas de un canal "UCxxxx" es "UUxxxx".
  const uploads = `UU${channelId.slice(2)}`;
  const out: ChannelVideo[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    type PL = { nextPageToken?: string; items: { snippet: { title: string; resourceId: { videoId: string } } }[] };
    const pl = await yt<PL>("playlistItems", { part: "snippet", playlistId: uploads, maxResults: "50", ...(pageToken ? { pageToken } : {}) });
    const ids = pl.items.map((i) => i.snippet.resourceId.videoId);
    if (ids.length > 0) {
      type V = { items: { id: string; contentDetails: { duration: string }; status: { embeddable: boolean } }[] };
      const v = await yt<V>("videos", { part: "contentDetails,status", id: ids.join(",") });
      const info = new Map(v.items.map((x) => [x.id, x]));
      for (const item of pl.items) {
        const meta = info.get(item.snippet.resourceId.videoId);
        if (!meta?.status.embeddable) continue;
        out.push({ id: meta.id, title: item.snippet.title, minutes: isoMinutes(meta.contentDetails.duration) });
      }
    }
    pageToken = pl.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Videos embebibles de un canal (cacheado un día; si falla no se guarda). */
export async function getChannelVideos(channelId: string): Promise<ChannelVideo[]> {
  if (!process.env.YOUTUBE_API_KEY) return [];
  try {
    return await unstable_cache(() => loadChannel(channelId), ["yt-channel", channelId], { revalidate: ONE_DAY })();
  } catch {
    return [];
  }
}

/** "Temporada 2 Episodio 5", "T2 E5", "S02E05", "2x05" → [2, 5] */
function seasonEpisode(title: string): [number, number] | null {
  const t = normalize(title);
  const m =
    t.match(/temporada (\d+)\D{0,20}?(?:episodio|capitulo|cap|ep|e) ?(\d+)/) ??
    t.match(/\b[st] ?(\d+) ?(?:e|ep) ?(\d+)\b/) ??
    t.match(/\b(\d+)x(\d+)\b/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export interface EpisodeQuery {
  season?: number;
  numberInSeason?: number;
  minutes: number;
  /** Nombres del episodio (latino y original) para comparar con el título del video. */
  names: string[];
  /**
   * Aceptar videos por "T1 E5"/"01x05" aunque el nombre no coincida. Se apaga en
   * series cuyo canal numera distinto que TMDB (ej. Power Rangers por temporada de cada saga).
   */
  matchByNumber: boolean;
}

/** Compilados, maratones y recortes: nunca son un episodio. */
const COMPILATION =
  /\b(\d+\s*(min|mins|minutos|hora|horas|hr)\b|compilad|compilaci|recopilaci|maraton|lo mejor|los mejores|las mejores|momentos|temporada \d+ completa|todos los (capitulos|episodios)|mix)/;

/**
 * Busca el episodio entre los videos de los canales oficiales de la serie.
 * Acepta un video si su título menciona el episodio (o su temporada y número)
 * y dura como un episodio completo: no clips ni compilados.
 */
/**
 * Títulos en español que el canal oficial pone a sus episodios, por "temporada:episodio"
 * ("Una línea en la arena | In Space | Episodio Completo | S06 | E41" → "6:41" = "Una línea en la arena").
 * Solo videos que duran como un episodio y no son compilados.
 */
export async function channelEpisodeTitles(channelIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const channel of await Promise.all(channelIds.map(getChannelVideos))) {
    for (const v of channel) {
      if (v.minutes < 9 || v.minutes > 40 || COMPILATION.test(normalize(v.title))) continue;
      const se = seasonEpisode(v.title);
      const name = v.title.split("|")[0].trim();
      if (se && name && !seasonEpisode(name) && !out.has(`${se[0]}:${se[1]}`)) out.set(`${se[0]}:${se[1]}`, name);
    }
  }
  return out;
}

export async function findInChannels(channelIds: string[], ep: EpisodeQuery): Promise<VideoSource | undefined> {
  return (await channelMatcher(channelIds))(ep);
}

/**
 * Carga una vez los videos de los canales y devuelve un buscador sincrónico
 * (para cruzar cientos de episodios de una serie).
 */
export async function channelMatcher(channelIds: string[]): Promise<(ep: EpisodeQuery) => VideoSource | undefined> {
  const channels = await Promise.all(channelIds.map(getChannelVideos));
  return (ep) => matchInChannels(channels, ep);
}

function matchInChannels(channels: ChannelVideo[][], ep: EpisodeQuery): VideoSource | undefined {
  const names = ep.names.filter((n) => normalize(n).length >= 4);
  const fits = (v: ChannelVideo) =>
    v.minutes >= ep.minutes * 0.6 && v.minutes <= Math.max(ep.minutes * 2.5, 30) && !COMPILATION.test(normalize(v.title));

  // Un nombre de una sola palabra ("Cambios", "Magia") aparece en cualquier título:
  // en ese caso el video tiene que empezar con ese nombre.
  const multiWord = names.filter((n) => normalize(n).includes(" "));
  const oneWord = names.filter((n) => !normalize(n).includes(" ")).map(normalize);
  const matchesName = (v: ChannelVideo) =>
    (multiWord.length > 0 && mentionsEpisode(v.title, multiWord)) || oneWord.some((w) => normalize(v.title).startsWith(w));

  for (const channel of channels) {
    const videos = channel.filter(fits);
    const byName = names.length > 0 ? videos.find(matchesName) : undefined;
    const byNumber =
      ep.matchByNumber && ep.season && ep.numberInSeason
        ? videos.find((v) => {
            const se = seasonEpisode(v.title);
            return se?.[0] === ep.season && se?.[1] === ep.numberInSeason;
          })
        : undefined;
    const hit = byName ?? byNumber;
    if (hit) return { type: "youtube", id: hit.id };
  }
  return undefined;
}
