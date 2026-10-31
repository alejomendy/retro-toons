import { NextRequest, NextResponse } from "next/server";
import { getStremioAddon } from "@/lib/stremio/addons";
import { getCatalogTitles } from "@/lib/stremio/client";

export const runtime = "nodejs";

/**
 * GET /api/addons?addon=&type=&catalog=&skip= → { success, results }
 * Una página de un catálogo de un addon, con nombres en español y la serie de LACartoons si está.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const addon = getStremioAddon(params.get("addon") ?? "");
  const type = params.get("type");
  const catalog = params.get("catalog");
  const skip = Math.max(0, Number(params.get("skip")) || 0);
  if (!addon || (type !== "movie" && type !== "series") || !catalog) {
    return NextResponse.json({ success: false, error: "Faltan addon, type o catalog." }, { status: 400 });
  }
  try {
    const results = await getCatalogTitles(addon.id, type, catalog, skip);
    return NextResponse.json({ success: true, results }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de conexión";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
