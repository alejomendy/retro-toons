import { NextRequest, NextResponse } from "next/server";
import { fetchCatalog, lcErrorResponse } from "@/lib/lacartoons";
import { withArtworkAll } from "@/lib/artwork";
import { searchCachedCatalog } from "@/lib/lacartoons-schedule";

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
    // Primero el catálogo en caché; si todavía no se pudo llenar, se le pregunta directo al addon.
    const found = await searchCachedCatalog({ search: query, genre, skip }).catch(() => fetchCatalog({ search: query, genre, skip }));
    const results = await withArtworkAll(found);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return lcErrorResponse(error, "búsqueda");
  }
}
