
// import { NextRequest, NextResponse } from "next/server";

// export const runtime = "nodejs";

// const ADDON_URL =
//     process.env.LACARTOONS_ADDON_URL ?? "http://127.0.0.1:7000";

// type RouteContext = {
//     params: Promise<{ id: string }>;
// };

// export async function GET(
//     _request: NextRequest,
//     context: RouteContext
// ) {
//     try {
//         const { id } = await context.params;

//         if (!id || id.includes("/")) {
//             return NextResponse.json(
//                 { success: false, error: "ID de episodio inválido." },
//                 { status: 400 }
//             );
//         }

//         const url = new URL(
//             `/stream/series/${encodeURIComponent(id)}.json`,
//             ADDON_URL
//         );

//         const response = await fetch(url, {
//             cache: "no-store",
//             signal: AbortSignal.timeout(20000),
//         });

//         if (!response.ok) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     error: "No se pudieron obtener las fuentes de video.",
//                 },
//                 { status: 502 }
//             );
//         }

//         const data = await response.json();

//         return NextResponse.json({
//             success: true,
//             streams: data.streams ?? [],
//         });
//     } catch (error) {
//         console.error("Error consultando fuentes de video:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 error: "No se pudo conectar con el servicio de reproducción.",
//             },
//             { status: 502 }
//         );
//     }
// }

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
