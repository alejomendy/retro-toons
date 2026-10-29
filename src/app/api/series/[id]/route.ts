import { NextRequest, NextResponse } from "next/server";
import { lcErrorResponse } from "@/lib/lacartoons";
import { cachedSeries } from "@/lib/lacartoons-schedule";

export const runtime = "nodejs";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** GET /api/series/:id — metadatos de la serie y sus episodios (`series.videos`). */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const series = await cachedSeries(id);
    return NextResponse.json({ success: true, series }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    return lcErrorResponse(error, "detalles");
  }
}
