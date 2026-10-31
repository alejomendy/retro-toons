import { NextRequest, NextResponse } from "next/server";
import { findWatchable } from "@/lib/availability";
import { findByImdb } from "@/lib/tmdb";

export const runtime = "nodejs";

const MAX_ITEMS = 60;

interface Item {
  id: string;
  name?: string;
}

/**
 * POST /api/disponibles — { items: [{ id: "tt...", name }] }
 * Para títulos de addons de Stremio: ficha en español latino (TMDB) y, si existe,
 * la página de RetroToons donde se puede ver → { success, results: { [id]: {...} } }.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const items = (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items) ? (body as { items: unknown[] }).items : [])
    .filter((item): item is Item => !!item && typeof item === "object" && typeof (item as Item).id === "string")
    .slice(0, MAX_ITEMS);
  if (items.length === 0) return NextResponse.json({ success: false, error: "Sin títulos para consultar." }, { status: 400 });

  const entries = await Promise.all(
    items.map(async (item) => {
      const es = await findByImdb(item.id);
      const watch = await findWatchable([es?.name, es?.originalName, item.name]);
      return [item.id, { name: es?.name || null, overview: es?.overview ?? null, poster: es?.poster ?? null, background: es?.backdrop ?? null, year: es?.year ?? null, watch }] as const;
    }),
  );
  return NextResponse.json({ success: true, results: Object.fromEntries(entries) });
}
