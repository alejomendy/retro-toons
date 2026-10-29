import { NextResponse } from "next/server";
import { channels } from "@/data/channels";

/** GET /api/canales — lista de canales con sus bloques de programación. */
export function GET() {
  return NextResponse.json({ canales: channels });
}
