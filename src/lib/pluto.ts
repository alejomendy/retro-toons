import "server-only";
import { unstable_cache } from "next/cache";
import { normalize } from "@/lib/text";
import type { FreeOption } from "@/lib/types";

/**
 * Pluto TV (gratis y legal, con publicidad) — endpoints públicos que usa su web.
 *   - Canales en vivo y series a demanda de cada serie, con lo que pasa ahora.
 *   - Stream HLS de cada episodio, para verlo en nuestro reproductor a través
 *     de /api/hls. Los cortes publicitarios de Pluto van incluidos en el stream.
 *
 * La región sale de la IP del servidor (desde Latinoamérica: catálogo "latam").
 */
const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const WEB = "https://pluto.tv/latam";

interface Session {
  token: string;
  /** Servidor que arma los streams HLS. */
  stitcher: string;
  stitcherParams: string;
}

/** Sesión anónima (el token dura un día; la renovamos cada hora). */
const getSession = unstable_cache(
  async (): Promise<Session> => {
    const qs = new URLSearchParams({
      appName: "web",
      appVersion: "9.0.0",
      deviceVersion: "120.0.0",
      deviceModel: "web",
      deviceMake: "chrome",
      deviceType: "web",
      clientID: crypto.randomUUID(),
      clientModelNumber: "1.0.0",
      // Publicidad incluida en el stream: Pluto se financia así.
      serverSideAds: "true",
    });
    const res = await fetch(`https://boot.pluto.tv/v4/start?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`[pluto] boot ${res.status}`);
    const boot = (await res.json()) as { sessionToken?: string; stitcherParams?: string; servers?: { stitcher?: string } };
    if (!boot.sessionToken || !boot.servers?.stitcher) throw new Error("[pluto] sesión incompleta");
    return { token: boot.sessionToken, stitcher: boot.servers.stitcher, stitcherParams: boot.stitcherParams ?? "" };
  },
  ["pluto-session"],
  { revalidate: ONE_HOUR },
);

/** Stream HLS de un episodio ("episode/<id>") o canal ("channel/<id>"), servido por /api/hls. */
function streamUrl({ token, stitcher, stitcherParams }: Session, path: string): string {
  const master = `${stitcher}/v2/stitch/hls/${path}/master.m3u8?${stitcherParams}&jwt=${token}&masterJWTPassthrough=true`;
  return `/api/hls?u=${encodeURIComponent(master)}`;
}

async function pluto<T>(url: string): Promise<T> {
  const { token } = await getSession();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`[pluto] ${res.status} en ${url}`);
  return (await res.json()) as T;
}

interface SearchItem {
  id: string;
  name: string;
  slug: string;
  type: "channel" | "series" | "movie" | string;
}

const search = unstable_cache(
  async (q: string) =>
    (await pluto<{ data?: SearchItem[] }>(`https://service-media-search.clusters.pluto.tv/v1/search?q=${encodeURIComponent(q)}&limit=20`)).data ?? [],
  ["pluto-search"],
  { revalidate: ONE_DAY },
);

/** "Hey Arnold! LT" / "Rugrats crecidos (latam)" → nombre comparable. */
function plutoName(name: string): string {
  return normalize(name).replace(/\b(lt|latam|las|ptv\d*)$/, "").trim();
}

/**
 * Canales y series de Pluto TV de una serie. Solo coincidencias exactas de
 * nombre (o canales que empiezan con el nombre, ej. "Bob Esponja Pantalones
 * Cuadrados"), para no mezclar especiales ni otras series parecidas.
 */
async function findItems(names: string[]): Promise<SearchItem[]> {
  const wanted = [...new Set(names.map(normalize).filter((n) => n.length >= 3))];
  const found = new Map<string, SearchItem>();
  for (const name of [...new Set(names)]) {
    const items = await search(name).catch(() => [] as SearchItem[]);
    for (const item of items) {
      if (item.type !== "channel" && item.type !== "series") continue;
      const n = plutoName(item.name);
      const exact = wanted.includes(n);
      const channelPrefix = item.type === "channel" && wanted.some((w) => n.startsWith(`${w} `));
      if (exact || channelPrefix) found.set(item.id, item);
    }
  }
  return [...found.values()];
}

interface Timeline {
  start: string;
  stop: string;
  title: string;
  episode?: { name?: string };
}

/** Programa actual de cada canal. */
async function nowPlaying(channelIds: string[]): Promise<Map<string, Timeline>> {
  const out = new Map<string, Timeline>();
  if (channelIds.length === 0) return out;
  const start = new Date().toISOString();
  const res = await pluto<{ data?: { channelId: string; timelines?: Timeline[] }[] }>(
    `https://service-channels.clusters.pluto.tv/v2/guide/timelines?start=${start}&channelIds=${channelIds.join(",")}&duration=120`,
  ).catch(() => ({ data: [] }));
  const now = Date.now();
  for (const c of res.data ?? []) {
    const current = c.timelines?.find((t) => Date.parse(t.start) <= now && now < Date.parse(t.stop)) ?? c.timelines?.[0];
    if (current) out.set(c.channelId, current);
  }
  return out;
}

/**
 * Opciones gratis en Pluto TV para una serie (canales en vivo primero).
 * `displayName` reemplaza el nombre de las series a demanda, que en Pluto a veces está en inglés.
 */
export async function getPlutoOptions(names: string[], displayName: string): Promise<FreeOption[]> {
  try {
    const items = await findItems(names);
    const channels = items.filter((i) => i.type === "channel");
    const [live, session] = await Promise.all([
      nowPlaying(channels.map((c) => c.id)),
      channels.length > 0 ? getSession().catch(() => null) : null,
    ]);
    const options: FreeOption[] = channels.map((c) => {
      const t = live.get(c.id);
      // En canales genéricos el título repite el nombre del canal: no aporta.
      const title = t?.episode?.name && normalize(t.episode.name) !== normalize(t.title) ? t.episode.name : t?.title;
      const informative = title && plutoName(title) !== plutoName(c.name);
      return {
        platform: "Pluto TV",
        kind: "canal",
        // Si el canal se llama igual que la serie, usar nuestro título (Pluto a veces lo deja en inglés).
        name: names.some((n) => normalize(n) === plutoName(c.name)) ? displayName : c.name,
        url: `${WEB}/live-tv/${c.slug}`,
        now: t && informative ? { title, until: t.stop } : null,
        stream: session ? streamUrl(session, `channel/${c.id}`) : undefined,
      };
    });
    // Una sola entrada a demanda por serie (Pluto a veces la tiene duplicada).
    const series = items.find((i) => i.type === "series");
    if (series) options.push({ platform: "Pluto TV", kind: "serie", name: displayName, url: `${WEB}/on-demand/series/${series.slug}`, now: null });
    return options;
  } catch {
    return [];
  }
}

export interface PlutoEpisode {
  id: string;
  season: number;
  number: number;
  name: string;
  description: string | null;
  slug: string;
}

const seriesEpisodes = unstable_cache(
  async (seriesSlug: string): Promise<PlutoEpisode[]> => {
    type E = { _id: string; name: string; description?: string; slug: string; number: number; season: number };
    const d = await pluto<{ seasons?: { episodes?: E[] }[] }>(
      `https://service-vod.clusters.pluto.tv/v4/vod/series/${seriesSlug}/seasons?offset=1000&page=1`,
    );
    return (d.seasons ?? []).flatMap((s) =>
      (s.episodes ?? []).map((e) => ({
        id: e._id,
        season: e.season,
        number: e.number,
        name: e.name,
        description: e.description?.trim() || null,
        slug: e.slug,
      })),
    );
  },
  ["pluto-series-episodes-v2"],
  { revalidate: ONE_DAY },
);

/** "Episodio 3", "Capítulo 12": Pluto no tiene el título real. */
const GENERIC_NAME = /^(episodio|capitulo|cap)\s*\d+$/;

/**
 * Episodios a demanda de cada serie de Pluto TV (ordenados), con título y sinopsis
 * en español solo cuando son reales: se descartan los genéricos ("Episodio 3") y
 * las sinopsis que se repiten en toda la serie.
 */
export async function getPlutoSeriesEpisodes(seriesNames: string[]): Promise<{ url: string; episodes: PlutoEpisode[] }[]> {
  try {
    const series = (await findItems(seriesNames)).filter((i) => i.type === "series");
    return await Promise.all(
      series.map(async (s) => {
        const eps = (await seriesEpisodes(s.slug)).toSorted((a, b) => a.season - b.season || a.number - b.number);
        const seen = new Map<string, number>();
        for (const e of eps) if (e.description) seen.set(e.description, (seen.get(e.description) ?? 0) + 1);
        return {
          url: `${WEB}/on-demand/series/${s.slug}`,
          episodes: eps.map((e) => ({
            ...e,
            name: GENERIC_NAME.test(normalize(e.name)) || plutoName(e.name) === plutoName(s.name) ? "" : e.name,
            description: e.description && seen.get(e.description) === 1 ? e.description : null,
          })),
        };
      }),
    );
  } catch {
    return [];
  }
}

export interface PlutoMatch {
  /** Página del episodio en pluto.tv. */
  webUrl: string;
  /** Stream HLS para nuestro reproductor (vía /api/hls). */
  streamUrl: string;
}

/**
 * El episodio exacto en Pluto TV:
 *   1) por nombre (latino u original);
 *   2) si no, por posición, pero solo cuando Pluto tiene exactamente la misma
 *      cantidad de episodios que nuestra serie (misma estructura, ej. Los Thornberrys 91 = 91).
 */
export async function findPlutoEpisode(
  seriesNames: string[],
  episodeNames: string[],
  position?: { number: number; total: number },
): Promise<PlutoMatch | null> {
  return (await plutoMatcher(seriesNames))?.(episodeNames, position) ?? null;
}

/** Artículos y conectores que cambian entre traducciones ("Carl & Maude" / "Carl y Maude"). */
const FILLER = new Set(["y", "e", "el", "la", "los", "las", "de", "del", "un", "una"]);

/**
 * Clave para comparar títulos tolerando diferencias de escritura: sin acentos,
 * sin signos ni espacios ("D-esestabilizada" = "Des-estabilizada") y sin conectores.
 */
function titleKey(title: string): string {
  return normalize(title.replace(/&/g, " y "))
    .split(" ")
    .filter((w) => !FILLER.has(w))
    .join("");
}

export type PlutoFinder = (episodeNames: string[], position?: { number: number; total: number }) => PlutoMatch | null;

/**
 * Carga una vez los episodios de Pluto de una serie y devuelve un buscador
 * sincrónico (para cruzar cientos de episodios sin repetir pedidos), o null si
 * la serie no está en Pluto.
 */
export async function plutoMatcher(seriesNames: string[]): Promise<PlutoFinder | null> {
  let catalog: { slug: string; eps: PlutoEpisode[] }[] = [];
  let session: Session | null = null;
  try {
    const series = (await findItems(seriesNames)).filter((i) => i.type === "series");
    catalog = await Promise.all(
      series.map(async (s) => ({
        slug: s.slug,
        eps: (await seriesEpisodes(s.slug)).toSorted((a, b) => a.season - b.season || a.number - b.number),
      })),
    );
    if (catalog.length > 0) session = await getSession();
  } catch {
    // Sin Pluto seguimos sin episodio.
  }

  if (!session) return null;
  const s = session;
  return (episodeNames, position) => {
    const parts = episodeNames.flatMap((n) => [n, ...n.split("/")]);
    const wanted = parts.map(normalize).filter((n) => n.length >= 4);
    const wantedKeys = new Set(parts.map(titleKey).filter((k) => k.length >= 4));
    for (const { slug, eps } of catalog) {
      const byName =
        wanted.length > 0
          ? eps.find((e) => {
              const n = normalize(e.name);
              // Pluto junta segmentos ("Musculoso / Dummy Dummy"): cada uno cuenta como título propio.
              const keys = [e.name, ...e.name.split("/")].map(titleKey);
              return wanted.some((w) => n === w || (w.includes(" ") && n.includes(w))) || keys.some((k) => wantedKeys.has(k));
            })
          : undefined;
      const byPosition = position && eps.length === position.total ? eps[position.number - 1] : undefined;
      const hit = byName ?? byPosition;
      if (hit) {
        return {
          webUrl: `${WEB}/on-demand/series/${slug}/season/${hit.season}/episode/${hit.slug}`,
          streamUrl: streamUrl(s, `episode/${hit.id}`),
        };
      }
    }
    return null;
  };
}
