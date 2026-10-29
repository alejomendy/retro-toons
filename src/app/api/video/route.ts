import { NextResponse, type NextRequest } from "next/server";
import { showById } from "@/data/shows";
import { getFullEpisode } from "@/lib/catalog";

/** GET /api/video?serie=dexter&ep=3 — fuente de video del episodio (o null). */
export async function GET(req: NextRequest) {
  const show = showById[req.nextUrl.searchParams.get("serie") ?? ""];
  const ep = Number(req.nextUrl.searchParams.get("ep"));
  if (!show || !Number.isInteger(ep) || ep < 1 || ep > show.episodeCount) {
    return NextResponse.json({ error: "Serie o episodio inválido" }, { status: 400 });
  }
  const episode = await getFullEpisode(show, ep);
  return NextResponse.json({ source: episode.source ?? null });
}
