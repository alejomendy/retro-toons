import { NextResponse, type NextRequest } from "next/server";
import { isChannelId } from "@/data/channels";
import { lcErrorResponse } from "@/lib/lacartoons";
import { getCachedSchedule } from "@/lib/lacartoons-schedule";

// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/**
 * GET /api/programacion?canal=cartoon-network&fecha=2026-10-29
 * Grilla del día con series y episodios de LACartoons.
 * La fecha la manda el cliente para respetar su zona horaria.
 */
export async function GET(req: NextRequest) {
  const canal = req.nextUrl.searchParams.get("canal");
  if (!isChannelId(canal)) return NextResponse.json({ success: false, error: "Canal inválido", code: "INVALID_ID" }, { status: 400 });

  const param = req.nextUrl.searchParams.get("fecha");
  const today = new Date();
  const fecha = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  try {
    const slots = await getCachedSchedule(canal, fecha);
    return NextResponse.json({ success: true, canal, slots });
  } catch (error) {
    return lcErrorResponse(error, "programación");
  }
}
