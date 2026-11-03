import { NextResponse, type NextRequest } from "next/server";
import { reportEpisode } from "@/lib/episode-health";

export const runtime = "nodejs";

/**
 * POST /api/episodios/estado  { id, ok }
 * El reproductor avisa si un episodio arrancó (ok) o si ninguna de sus fuentes anduvo: la grilla de la
 * programación se arma con lo que se sabe que se puede ver (ver lib/episode-health.ts).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; ok?: unknown } | null;
  if (typeof body?.id !== "string" || typeof body.ok !== "boolean") {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  reportEpisode(body.id, body.ok);
  return NextResponse.json({ success: true });
}
