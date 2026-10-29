import { NextRequest, NextResponse } from "next/server";
import { fetchSeries, lcErrorResponse } from "@/lib/lacartoons";
import { withArtwork } from "@/lib/artwork";

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
    const series = await withArtwork(await fetchSeries(id));
    return NextResponse.json({ success: true, series });
  } catch (error) {
    return lcErrorResponse(error, "detalles");
  }
}
