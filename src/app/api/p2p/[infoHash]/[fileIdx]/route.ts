import { NextRequest, NextResponse } from "next/server";
import { ensureTorrentReady, getServerPort } from "@/lib/p2p-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ infoHash: string; fileIdx: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { infoHash, fileIdx } = await context.params;
    const idx = Number.parseInt(fileIdx, 10) || 0;

    const torrent = await ensureTorrentReady(infoHash, 25000);
    const file = torrent.files[idx] || torrent.files[0];
    if (!file) {
      return NextResponse.json({ error: "Archivo no encontrado en torrent" }, { status: 404 });
    }

    const port = await getServerPort();
    const streamPath = file.streamURL || `/webtorrent/${encodeURIComponent(torrent.infoHash)}/${idx}`;
    const targetUrl = `http://127.0.0.1:${port}${streamPath}`;

    const headers: Record<string, string> = {};
    const range = request.headers.get("range");
    if (range) headers.range = range;

    const backendRes = await fetch(targetUrl, {
      headers,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const copyHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "content-disposition",
    ];

    for (const h of copyHeaders) {
      const val = backendRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    }

    // Asegurar que el navegador entienda que puede pedir tramos (seeking)
    responseHeaders.set("accept-ranges", "bytes");

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[api/p2p] Error en streaming:", error);
    return NextResponse.json(
      { error: "Error al iniciar stream P2P", details: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}

