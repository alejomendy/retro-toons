import "server-only";

const TORRENTIO_BASE = process.env.TORRENTIO_BASE?.trim() || "https://torrentio.strem.fun";
const CACHE_MS = 60 * 60 * 1000;

export interface TorrentStream {
  infoHash: string;
  fileIdx: number;
  title: string;
  resolution: string;
  size: string;
  seeders: number;
  isLatino: boolean;
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

  // Idioma (Español Latino / Castellano / Multi / Dual)
  const isLatino = /\b(latino|español|espanol|castellano|spanish|dual|multi|\blat\b|\bspa\b)\b/i.test(combined);

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
    isLatino,
    rawTitle: combined,
  };
}

/**
 * Consulta Torrentio por torrents de un episodio dado el IMDb ID de la serie.
 */
export async function getTorrentStreams(imdbId: string, season: number, episode: number): Promise<TorrentStream[]> {
  const key = `series:${imdbId}:${season}:${episode}`;
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

    const parsed = data.streams
      .map(parseStream)
      .filter((s): s is TorrentStream => s !== null && s.seeders >= 0);

    // Ordenar: primero streams con audio Latino/Español, luego por cantidad de semillas
    parsed.sort((a, b) => {
      if (a.isLatino !== b.isLatino) return a.isLatino ? -1 : 1;
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
 * Consulta Torrentio para una película dado su IMDb ID.
 */
export async function getMovieTorrentStreams(imdbId: string): Promise<TorrentStream[]> {
  const key = `movie:${imdbId}`;
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

    const parsed = data.streams
      .map(parseStream)
      .filter((s): s is TorrentStream => s !== null);

    parsed.sort((a, b) => {
      if (a.isLatino !== b.isLatino) return a.isLatino ? -1 : 1;
      return b.seeders - a.seeders;
    });

    cache.set(key, { streams: parsed, at: Date.now() });
    return parsed;
  } catch (err) {
    console.warn(`[torrentio] Error al consultar película ${url}:`, err);
    return [];
  }
}

