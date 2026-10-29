// import { NextResponse } from "next/server";
// import { showById } from "@/data/shows";
// import { getShowWithEpisodes } from "@/lib/catalog";

// /** GET /api/series/:id — serie + episodios en español (TMDB). */
// export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
//   const show = showById[(await params).id];
//   if (!show) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
//   return NextResponse.json(await getShowWithEpisodes(show));
// }

import { NextRequest, NextResponse } from "next/server";
import { fetchSeries, lcErrorResponse } from "@/lib/lacartoons";

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
    const series = await fetchSeries(id);
    return NextResponse.json({ success: true, series });
  } catch (error) {
    return lcErrorResponse(error, "detalles");
  }
}
