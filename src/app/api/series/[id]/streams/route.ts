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

async function getP2pStreamsForEpisode(id: string): Promise<LcStream[]> {
  try {
    const parts = id.split(":");
    const seriesId = parts[0];
    const season = parts.length >= 3 ? Number.parseInt(parts[1], 10) || 1 : 1;
    const episode = parts.length >= 3 ? Number.parseInt(parts[2], 10) || 1 : Number.parseInt(parts[1], 10) || 1;

    let imdbId: string | null = null;
    const local = showById[seriesId];
    if (local?.tmdbId) {
      imdbId = await getImdbIdFromTmdb(local.tmdbId);
    } else if (local) {
      imdbId = await findImdbId(local.originalTitle || local.title, local.year);
    } else {
      const pName = (playableList.series as Record<string, { name: string } | undefined>)[seriesId]?.name;
      if (pName) {
        imdbId = await findImdbId(pName);
      }
    }

    if (!imdbId) return [];

    const torrents = await getTorrentStreams(imdbId, season, episode);
    return torrents.slice(0, 4).map((t) => ({
      url: `/api/p2p/${t.infoHash}/${t.fileIdx}`,
      label: `P2P · ${t.resolution} ${t.isLatino ? "🇲🇽 Latino" : ""} (${t.seeders} seeds)`,
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

/** GET /api/series/:episodeId/streams — fuentes de video del episodio (LACartoons + P2P Torrentio). */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let streams: LcStream[] = [];
  let lcFailed = false;

  try {
    streams = await fetchStreamsCached(id);
  } catch (error) {
    lcFailed = true;
    console.warn(`[streams] LACartoons falló para ${id}, buscando alternativas:`, error instanceof Error ? error.message : error);
  }

  // Si LACartoons no tiene fuentes, falló, o queremos brindar opciones P2P adicionales
  const p2pStreams = await getP2pStreamsForEpisode(id);
  const combined = [...streams, ...p2pStreams];

  if (combined.length === 0) {
    if (lcFailed) return lcErrorResponse(new LcError("NO_STREAMS"), "streams");
    return NextResponse.json({ success: true, streams: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { success: true, streams: combined },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } }
  );
}
