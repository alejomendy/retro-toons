// import { NextResponse, type NextRequest } from "next/server";
// import { isChannelId } from "@/data/channels";
// import { shows } from "@/data/shows";

// /** GET /api/series?q=texto&canal=nickelodeon — catálogo filtrable. */
// export function GET(req: NextRequest) {
//   const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
//   const canal = req.nextUrl.searchParams.get("canal");

//   const series = shows
//     .filter((s) => !isChannelId(canal) || s.channels.includes(canal))
//     .filter((s) => !q || [s.title, s.originalTitle, s.genre].some((t) => t.toLowerCase().includes(q)));

//   return NextResponse.json({ total: series.length, series });
// }

import { NextRequest, NextResponse } from "next/server";
import { fetchCatalog, lcErrorResponse } from "@/lib/lacartoons";

export const runtime = "nodejs";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/**
 * GET /api/series?q=texto&genre=Nickelodeon&skip=20
 * Busca en el catálogo de LACartoons. Sin `q` ni `genre` devuelve el catálogo general.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim().slice(0, 100) || undefined;
  const genre = params.get("genre")?.trim().slice(0, 60) || undefined;
  const skip = Math.max(0, Number(params.get("skip")) || 0);

  try {
    const results = await fetchCatalog({ search: query, genre, skip });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return lcErrorResponse(error, "búsqueda");
  }
}
