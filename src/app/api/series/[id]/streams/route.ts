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
        return NextResponse.json({ success: true, streams });
    } catch (error) {
        return lcErrorResponse(error, "streams");
    }
}
