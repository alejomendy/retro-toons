import { NextResponse, type NextRequest } from "next/server";
import { isChannelId } from "@/data/channels";
import { shows } from "@/data/shows";

/** GET /api/series?q=texto&canal=nickelodeon — catálogo filtrable. */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const canal = req.nextUrl.searchParams.get("canal");

  const series = shows
    .filter((s) => !isChannelId(canal) || s.channels.includes(canal))
    .filter((s) => !q || [s.title, s.originalTitle, s.genre].some((t) => t.toLowerCase().includes(q)));

  return NextResponse.json({ total: series.length, series });
}
