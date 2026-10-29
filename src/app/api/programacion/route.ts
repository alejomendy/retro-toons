import { NextResponse, type NextRequest } from "next/server";
import { isChannelId } from "@/data/channels";
import { parseDateParam } from "@/lib/catalog";
import { lcErrorResponse } from "@/lib/lacartoons";
import { getLcSchedule } from "@/lib/lacartoons-schedule";

/**
 * GET /api/programacion?canal=cartoon-network&fecha=2026-10-29
 * Grilla del día con series y episodios de LACartoons.
 * La fecha la manda el cliente para respetar su zona horaria.
 */
export async function GET(req: NextRequest) {
  const canal = req.nextUrl.searchParams.get("canal");
  if (!isChannelId(canal)) return NextResponse.json({ success: false, error: "Canal inválido", code: "INVALID_ID" }, { status: 400 });

  const fecha = parseDateParam(req.nextUrl.searchParams.get("fecha"));
  try {
    const slots = await getLcSchedule(canal, fecha);
    return NextResponse.json({ success: true, canal, slots });
  } catch (error) {
    return lcErrorResponse(error, "programación");
  }
}
