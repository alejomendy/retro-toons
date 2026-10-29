import { NextResponse, type NextRequest } from "next/server";
import { channels, isChannelId } from "@/data/channels";
import { lcErrorResponse } from "@/lib/lacartoons";
import { getCachedSchedule } from "@/lib/lacartoons-schedule";
import type { LcSlot } from "@/lib/lacartoons-types";

// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/** Grilla completa: la CDN de Vercel la sirve una hora y la renueva en segundo plano. */
const CACHED = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
/** Grilla incompleta (el addon no respondió del todo): que nadie la guarde. */
const UNCACHED = { "Cache-Control": "no-store" };

/**
 * GET /api/programacion?canal=cartoon-network&fecha=2026-10-29
 * Grilla del día con series y episodios de LACartoons.
 * Con `canal=todos` devuelve las de todos los canales en una sola respuesta (`grids`).
 * La fecha la manda el cliente para respetar su zona horaria.
 */
export async function GET(req: NextRequest) {
  const canal = req.nextUrl.searchParams.get("canal");
  if (canal !== "todos" && !isChannelId(canal)) return NextResponse.json({ success: false, error: "Canal inválido", code: "INVALID_ID" }, { status: 400 });

  const param = req.nextUrl.searchParams.get("fecha");
  const today = new Date();
  const fecha = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (canal === "todos") {
    const results = await Promise.all(channels.map((c) => getCachedSchedule(c.id, fecha).catch(() => null)));
    const grids: Record<string, LcSlot[] | null> = {};
    channels.forEach((c, i) => (grids[c.id] = results[i]?.slots ?? null));
    const complete = results.every((r) => r?.complete);
    return NextResponse.json({ success: true, grids }, { headers: complete ? CACHED : UNCACHED });
  }

  try {
    const { slots, complete } = await getCachedSchedule(canal, fecha);
    return NextResponse.json({ success: true, canal, slots }, { headers: complete ? CACHED : UNCACHED });
  } catch (error) {
    return lcErrorResponse(error, "programación");
  }
}
