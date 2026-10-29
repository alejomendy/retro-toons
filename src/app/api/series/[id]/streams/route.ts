import { NextRequest, NextResponse } from "next/server";
import { fetchStreamsCached, lcErrorResponse } from "@/lib/lacartoons";

export const runtime = "nodejs";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

type RouteContext = {
    params: Promise<{ id: string }>;
};

/** GET /api/series/:episodeId/streams — fuentes de video del episodio. */
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const streams = await fetchStreamsCached(id);
        // Con fuentes, la CDN las sirve media hora (el servidor ya las guarda 3 h); vacías, no se guardan.
        return NextResponse.json({ success: true, streams }, { headers: { "Cache-Control": streams.length > 0 ? "public, s-maxage=1800, stale-while-revalidate=1800" : "no-store" } });
    } catch (error) {
        return lcErrorResponse(error, "streams");
    }
}
