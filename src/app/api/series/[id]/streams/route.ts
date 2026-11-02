import { NextRequest, NextResponse } from "next/server";
import { fetchStreamsCached, lcErrorResponse, LcError } from "@/lib/lacartoons";
import type { LcStream } from "@/lib/lacartoons-types";
import { showById } from "@/data/shows";
import playableList from "@/data/playable.json";
import { getImdbIdFromTmdb, findImdbId } from "@/lib/imdb";
import { getTorrentStreams } from "@/lib/torrentio";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Caché en memoria para resolver IMDb ID de series rápidamente sin llamar repetidamente a TMDB
const imdbResolved = new Map<string, { imdbId: string | null; isAnime: boolean }>();

async function resolveImdbAndType(seriesId: string): Promise<{ imdbId: string | null; isAnime: boolean }> {
  const cached = imdbResolved.get(seriesId);
  if (cached) return cached;

  let isAnime = false;
  let imdbId: string | null = null;

  const local = showById[seriesId];
  if (local) {
    isAnime = local.genre?.toLowerCase().includes("anime") || (local.channels && local.channels.length === 0);
    if (local.tmdbId) {
      imdbId = await getImdbIdFromTmdb(local.tmdbId);
    } else {
      imdbId = await findImdbId(local.originalTitle || local.title, local.year);
    }
  } else {
    // Es un ID de LACartoons tipo "lacart_41"
    const pName = (playableList.series as Record<string, { name: string } | undefined>)[seriesId]?.name;
    if (pName) {
      isAnime = /dragon ball|saint seiya|caballeros|sailor moon|ranma|pokemon|digimon|evangelion|inuyasha|sakura|yugioh|yu-gi-oh|slam dunk|samurai x|samurai champloo|cowboy bebop|trigun|zatch|shaman|beyblade|medabots|detective conan|mazinger|attack on titan|shingeki|demon slayer|kimetsu|jujutsu|hunter x hunter|bleach|naruto|one piece/i.test(pName);
      imdbId = await findImdbId(pName);
    }
  }

  const result = { imdbId, isAnime };
  imdbResolved.set(seriesId, result);
  return result;
}

async function getP2pStreamsForEpisode(id: string): Promise<LcStream[]> {
  try {
    const parts = id.split(":");
    const seriesId = parts[0];
    const season = parts.length >= 3 ? Number.parseInt(parts[1], 10) || 1 : 1;
    const episode = parts.length >= 3 ? Number.parseInt(parts[2], 10) || 1 : Number.parseInt(parts[1], 10) || 1;

    const { imdbId, isAnime } = await resolveImdbAndType(seriesId);
    if (!imdbId) return [];

    const torrents = await getTorrentStreams(imdbId, season, episode, { isAnime });
    return torrents.slice(0, 4).map((t) => ({
      url: `/api/p2p/${t.infoHash}/${t.fileIdx}`,
      label: `P2P · ${t.resolution} ${t.tagLabel || (t.isLatino ? "🇲🇽 Latino" : "")} (${t.seeders} seeds)`,
      kind: "mp4",
      mimeType: "video/mp4",
      notWebReady: false,
      requiresHeaders: false,
    }));
  } catch (err) {
    console.warn(`[streams] Error buscando fuentes P2P para ${id}:`, err);
    return [];
  }
}

/**
 * GET /api/series/:episodeId/streams
 * Prioriza fuentes P2P de Torrentio en Español Latino para que la programación y la biblioteca
 * reproduzcan instantáneamente y con alta calidad sin depender de los servidores caídos de LACartoons.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  // 1. Obtener de inmediato las fuentes P2P de Torrentio en Español Latino
  const p2pPromise = getP2pStreamsForEpisode(id).catch(() => []);

  // 2. Consultar LACartoons con un timeout corto para no demorar la reproducción
  const lcPromise = Promise.race([
    fetchStreamsCached(id).catch((err) => {
      console.warn(`[streams] LACartoons no disponible para ${id}:`, err instanceof Error ? err.message : err);
      return [] as LcStream[];
    }),
    new Promise<LcStream[]>((resolve) => setTimeout(() => resolve([]), 3500)),
  ]);

  const [p2pStreams, lcStreams] = await Promise.all([p2pPromise, lcPromise]);

  // Torrentio P2P VA PRIMERO para que el reproductor lo elija de forma inmediata
  const combined = [...p2pStreams, ...lcStreams];

  if (combined.length === 0) {
    // Si aún no hubo P2P ni respondió el timeout de 3.5s, esperar la respuesta completa de LACartoons como último recurso
    try {
      const fallbackStreams = await fetchStreamsCached(id);
      if (fallbackStreams.length > 0) {
        return NextResponse.json(
          { success: true, streams: fallbackStreams },
          { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } }
        );
      }
    } catch {
      // Ignorar error de fallback
    }

    return lcErrorResponse(new LcError("NO_STREAMS"), "streams");
  }

  return NextResponse.json(
    { success: true, streams: combined },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } }
  );
}
