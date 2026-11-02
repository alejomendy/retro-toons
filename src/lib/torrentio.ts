import "server-only";

const TORRENTIO_BASE = process.env.TORRENTIO_BASE?.trim() || "https://torrentio.strem.fun";
const CACHE_MS = 60 * 60 * 1000;

export type AudioLanguage = "latino" | "dual-latino" | "castellano" | "sub-es" | "other";

export interface TorrentStream {
  infoHash: string;
  fileIdx: number;
  title: string;
  resolution: string;
  size: string;
  seeders: number;
  language: AudioLanguage;
  isLatino: boolean;
  hasSpanishSubs: boolean;
  tagLabel: string;
  rawTitle: string;
}

interface RawTorrentioStream {
  name?: string;
  title?: string;
  infoHash?: string;
  fileIdx?: number;
}

interface RawTorrentioResponse {
  streams?: RawTorrentioStream[];
}

const cache = new Map<string, { streams: TorrentStream[]; at: number }>();

function parseStream(raw: RawTorrentioStream): TorrentStream | null {
  if (!raw.infoHash) return null;

  const titleText = raw.title || "";
  const nameText = raw.name || "";
  const combined = `${nameText}\n${titleText}`;

  // Semillas: 👤 37
  const seedMatch = combined.match(/👤\s*(\d+)/);
  const seeders = seedMatch ? Number.parseInt(seedMatch[1], 10) : 0;

  // Tamaño: 💾 1.33 GB
  const sizeMatch = combined.match(/💾\s*([0-9.]+\s*[MGK]B)/i);
  const size = sizeMatch ? sizeMatch[1].trim() : "";

  // Resolución
  const resMatch = combined.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
  const resolution = resMatch ? resMatch[1].toUpperCase() : "720P";

  // Detección precisa de idioma
  const hasLatino =
    /\b(latino|latam|latin|audio latino|doblaje latino|dvdrip latino|\blat\b)\b/i.test(combined) ||
    combined.includes("🇲🇽") ||
    combined.includes("Latin America");

  const hasDualOrMulti = /\b(dual|multi|audio dual|multi-audio|multiaudio)\b/i.test(combined);

  const hasCastellano =
    /\b(castellano|español|espanol|spanish|\bspa\b|esp)\b/i.test(combined) ||
    combined.includes("🇪🇸");

  const hasSpanishSubs =
    /(\bsub|\bsubs|subtitulad[oa]|subbed|softsubs?)\b/i.test(combined) &&
    /(\bes\b|\besp\b|\bspa\b|spanish|español|latino)/i.test(combined) ||
    /\[(?:sub-?esp|esp|sub español|sub-es)\]/i.test(combined) ||
    /\b(erai-raws|puyasubs|animemf|animeteam|nanikano|kagura|yousei)\b/i.test(combined);

  let language: AudioLanguage = "other";
  let tagLabel = "";

  if (hasLatino && hasDualOrMulti) {
    language = "dual-latino";
    tagLabel = "🇲🇽 Dual Latino";
  } else if (hasLatino) {
    language = "latino";
    tagLabel = "🇲🇽 Latino";
  } else if (hasSpanishSubs) {
    language = "sub-es";
    tagLabel = "💬 Subs Español";
  } else if (hasCastellano) {
    language = "castellano";
    tagLabel = "🇪🇸 Español";
  } else if (hasDualOrMulti) {
    language = "dual-latino";
    tagLabel = "🌐 Multi Audio";
  }

  // Título amigable del archivo
  const lines = titleText.split("\n").map((l) => l.trim()).filter(Boolean);
  const cleanTitle = lines[1] || lines[0] || "Episodio";

  return {
    infoHash: raw.infoHash.toLowerCase(),
    fileIdx: typeof raw.fileIdx === "number" ? raw.fileIdx : 0,
    title: cleanTitle,
    resolution,
    size,
    seeders,
    language,
    isLatino: language === "latino" || language === "dual-latino",
    hasSpanishSubs: language === "sub-es",
    tagLabel,
    rawTitle: combined,
  };
}

export interface StreamOptions {
  isAnime?: boolean;
}

/**
 * Consulta Torrentio por torrents de un episodio dado el IMDb ID de la serie.
 * - Para Cartoons/Retro: asegura audio latino o español y descarta streams en inglés/otros idiomas.
 * - Para Anime: acepta tanto audio latino como subtítulos en español (priorizando latino).
 */
export async function getTorrentStreams(
  imdbId: string,
  season: number,
  episode: number,
  options?: StreamOptions,
): Promise<TorrentStream[]> {
  const isAnime = !!options?.isAnime;
  const key = `series:${imdbId}:${season}:${episode}:${isAnime ? "anime" : "cartoon"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.streams;

  const url = `${TORRENTIO_BASE}/stream/series/${encodeURIComponent(imdbId)}:${season}:${episode}.json`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    const data = (await res.json()) as RawTorrentioResponse;
    if (!Array.isArray(data.streams)) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    let parsed = data.streams
      .map(parseStream)
      .filter((s): s is TorrentStream => s !== null && s.seeders >= 0);

    // Filtro estricto según preferencia del usuario
    if (isAnime) {
      // Para anime: se acepta audio latino, multi, subtítulos en español o castellano
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "sub-es" || s.language === "castellano",
      );
    } else {
      // Para cartoons / series retro: estrictamente en audio latino / español
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "castellano",
      );
    }

    // Orden de preferencia:
    // 1. Latino
    // 2. Dual Latino
    // 3. Subs Español (en anime)
    // 4. Castellano
    // Luego por cantidad de semillas
    const priority = (s: TorrentStream): number => {
      if (s.language === "latino") return 4;
      if (s.language === "dual-latino") return 3;
      if (s.language === "sub-es") return 2;
      if (s.language === "castellano") return 1;
      return 0;
    };

    parsed.sort((a, b) => {
      const diff = priority(b) - priority(a);
      if (diff !== 0) return diff;
      return b.seeders - a.seeders;
    });

    cache.set(key, { streams: parsed, at: Date.now() });
    return parsed;
  } catch (err) {
    console.warn(`[torrentio] Error al consultar ${url}:`, err);
    return [];
  }
}

/**
 * Consulta Torrentio para una película dado su IMDb ID en español latino/subtitulado.
 */
export async function getMovieTorrentStreams(imdbId: string, options?: StreamOptions): Promise<TorrentStream[]> {
  const isAnime = !!options?.isAnime;
  const key = `movie:${imdbId}:${isAnime ? "anime" : "regular"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.streams;

  const url = `${TORRENTIO_BASE}/stream/movie/${encodeURIComponent(imdbId)}.json`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    const data = (await res.json()) as RawTorrentioResponse;
    if (!Array.isArray(data.streams)) {
      cache.set(key, { streams: [], at: Date.now() });
      return [];
    }

    let parsed = data.streams
      .map(parseStream)
      .filter((s): s is TorrentStream => s !== null);

    if (isAnime) {
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "sub-es" || s.language === "castellano",
      );
    } else {
      parsed = parsed.filter(
        (s) => s.language === "latino" || s.language === "dual-latino" || s.language === "castellano",
      );
    }

    const priority = (s: TorrentStream): number => {
      if (s.language === "latino") return 4;
      if (s.language === "dual-latino") return 3;
      if (s.language === "sub-es") return 2;
      if (s.language === "castellano") return 1;
      return 0;
    };

    parsed.sort((a, b) => {
      const diff = priority(b) - priority(a);
      if (diff !== 0) return diff;
      return b.seeders - a.seeders;
    });

    cache.set(key, { streams: parsed, at: Date.now() });
    return parsed;
  } catch (err) {
    console.warn(`[torrentio] Error al consultar película ${url}:`, err);
    return [];
  }
}
