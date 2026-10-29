import { NextResponse } from "next/server";
import { showById } from "@/data/shows";
import { getShowWithEpisodes } from "@/lib/catalog";

/** GET /api/series/:id — serie + episodios enriquecidos con TVmaze. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const show = showById[(await params).id];
  if (!show) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
  return NextResponse.json(await getShowWithEpisodes(show));
}
