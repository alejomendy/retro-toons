import { NextRequest, NextResponse } from "next/server";
import { fetchStreamsCached, LcError } from "@/lib/lacartoons";
import { reportEpisode } from "@/lib/episode-health";
import { viewerWaiting } from "@/lib/schedule-warmer";
import type { LcStream } from "@/lib/lacartoons-types";
import { episodeTorrents, resolveSeriesImdb } from "@/lib/series-imdb";

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

    const { imdbId, isAnime } = await resolveSeriesImdb(seriesId);
    if (!imdbId) return [];

    const torrents = await episodeTorrents(imdbId, season, episode, { isAnime });
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
/** Lo que se espera a LACartoons cuando no hay P2P (el addon tarda 3-20 s en extraer un episodio). */
const LC_WAIT_MS = 3500;
/** Con P2P ya encontrado, LACartoons solo suma alternativas: no se demora la respuesta por eso. */
const LC_GRACE_MS = 600;
const after = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  // Mientras tanto el verificador anticipado no le ocupa el addon (lib/schedule-warmer.ts).
  const done = viewerWaiting();
  try {
    return await findStreams(id);
  } finally {
    done();
  }
}

async function findStreams(id: string) {
  const startedAt = Date.now();
  // Torrentio P2P y LACartoons se buscan en paralelo.
  const p2pPromise = getP2pStreamsForEpisode(id).catch((): LcStream[] => []);
  // Si el addon falla (caído, saturado) no se sabe si el episodio tiene video: no se anota como roto.
  let lcFailed = false;
  const lcPromise = fetchStreamsCached(id).catch((err) => {
    lcFailed = true;
    console.warn(`[streams] LACartoons no disponible para ${id}:`, err instanceof Error ? err.message : err);
    return [] as LcStream[];
  });

  const p2pStreams = await p2pPromise;
  const lcWait = p2pStreams.length > 0 ? LC_GRACE_MS : Math.max(0, LC_WAIT_MS - (Date.now() - startedAt));
  let lcStreams = await Promise.race([lcPromise, after(lcWait, [] as LcStream[])]);

  // Sin P2P: se espera la respuesta completa de LACartoons (el addon corta a los 45 s). Extraer el link
  // de algunos hosts (sendvid, rpmvid) tarda 15-30 s: cortar antes dejaba sin video a episodios que andan.
  if (p2pStreams.length === 0 && lcStreams.length === 0) lcStreams = await lcPromise;

  // Torrentio P2P va primero para que el reproductor lo elija de forma inmediata.
  const combined = [...p2pStreams, ...lcStreams];

  if (combined.length === 0) {
    // 200 con success:false (no 404): que no haya fuentes es un resultado esperado de la tele en vivo,
    // que en ese caso prueba otro episodio; un 404 solo llenaba la consola del navegador de errores.
    if (!lcFailed) reportEpisode(id, false);
    const err = new LcError("NO_STREAMS");
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { success: true, streams: combined },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } }
  );
}
