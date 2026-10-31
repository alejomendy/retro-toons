import { NextRequest, NextResponse } from "next/server";
import { getTmdbShow } from "@/lib/tmdb";

export const runtime = "nodejs";
export const revalidate = 43200;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const tmdbId = Number(id);
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ success: false, error: "Identificador de serie no válido." }, { status: 400 });
  const show = await getTmdbShow(tmdbId);
  if (!show) return NextResponse.json({ success: false, error: "No se encontraron los detalles de esta serie." }, { status: 404 });
  return NextResponse.json({ success: true, show }, { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } });
}
