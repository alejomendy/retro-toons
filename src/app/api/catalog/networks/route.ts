import { NextRequest, NextResponse } from "next/server";
import { CARTOON_NETWORKS, discoverNetworkShows, type NetworkKey, type NetworkShow } from "@/lib/network-catalog";
import { findWatchable } from "@/lib/availability";

export const runtime = "nodejs";
export const revalidate = 43200;

/** Páginas de TMDB que se recorren para armar la lista de "solo disponibles" (20 títulos cada una). */
const MAX_PAGES_AVAILABLE = 15;

async function withWatch(results: NetworkShow[]) {
  return Promise.all(results.map(async (show) => ({ ...show, watch: await findWatchable([show.name, show.originalName]) })));
}

export async function GET(request: NextRequest) {
  const network = request.nextUrl.searchParams.get("network") as NetworkKey | null;
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const onlyAvailable = request.nextUrl.searchParams.get("disponibles") === "1";
  if (!network || !(network in CARTOON_NETWORKS)) {
    return NextResponse.json({ success: false, error: "Canal no válido. Usá cartoon-network o disney-channel." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return NextResponse.json({ success: false, error: "Página no válida." }, { status: 400 });
  }
  const headers = { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" };

  if (onlyAvailable) {
    // Todo lo que se puede ver de la cadena, en una sola respuesta (ordenado por popularidad).
    const first = await discoverNetworkShows(network, 1);
    if (!first) return unavailable();
    const pages = Math.min(first.totalPages, MAX_PAGES_AVAILABLE);
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => discoverNetworkShows(network, i + 2)));
    const all = [first, ...rest].flatMap((r) => r?.results ?? []);
    const unique = [...new Map(all.map((s) => [s.id, s])).values()];
    const annotated = (await withWatch(unique)).filter((s) => s.watch);
    // Una serie de RetroToons aparece una sola vez aunque TMDB tenga varias versiones con el mismo nombre
    // (ej. Ben 10 de 2005 y de 2016): se queda la más vieja, que es la que pasaba la tele de la tarde.
    const oldest = new Map<string, (typeof annotated)[number]>();
    for (const show of annotated) {
      const current = oldest.get(show.watch!.href);
      if (!current || (show.firstAirDate ?? "9999") < (current.firstAirDate ?? "9999")) oldest.set(show.watch!.href, show);
    }
    const keep = new Set(oldest.values());
    const results = annotated.filter((s) => keep.has(s));
    return NextResponse.json(
      { success: true, network, networkName: first.networkName, page: 1, totalPages: 1, totalResults: results.length, totalIndexed: first.totalResults, results },
      { headers },
    );
  }

  const result = await discoverNetworkShows(network, page);
  if (!result) return unavailable();
  return NextResponse.json({ success: true, ...result, results: await withWatch(result.results) }, { headers });
}

function unavailable() {
  const configured = Boolean(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);
  return NextResponse.json(
    { success: false, error: configured ? "TMDB no respondió. Intentá nuevamente." : "Configurá TMDB_READ_TOKEN o TMDB_API_KEY en .env.local para activar los catálogos por canal." },
    { status: configured ? 502 : 503 },
  );
}
