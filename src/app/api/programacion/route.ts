import { NextResponse, type NextRequest } from "next/server";
import { isChannelId } from "@/data/channels";
import { getEnrichedSchedule, parseDateParam } from "@/lib/catalog";

/**
 * GET /api/programacion?canal=cartoon-network&fecha=2026-10-29
 * La fecha la manda el cliente para respetar su zona horaria.
 */
export async function GET(req: NextRequest) {
  const canal = req.nextUrl.searchParams.get("canal");
  if (!isChannelId(canal)) return NextResponse.json({ error: "Canal inválido" }, { status: 400 });

  const fecha = parseDateParam(req.nextUrl.searchParams.get("fecha"));
  const slots = await getEnrichedSchedule(canal, fecha);
  return NextResponse.json({ canal, slots });
}
