import { NextRequest, NextResponse } from "next/server";
import { getTmdbSeason } from "@/lib/tmdb";

export const runtime = "nodejs";
export const revalidate = 43200;

type Context = { params: Promise<{ id: string; season: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id, season } = await context.params;
  const tmdbId = Number(id);
  const seasonNumber = Number(season);
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0 || !Number.isSafeInteger(seasonNumber) || seasonNumber < 0 || seasonNumber > 100) {
    return NextResponse.json({ success: false, error: "Serie o temporada no válida." }, { status: 400 });
  }
  const episodes = await getTmdbSeason(tmdbId, seasonNumber);
  return NextResponse.json({ success: true, episodes }, { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } });
}
