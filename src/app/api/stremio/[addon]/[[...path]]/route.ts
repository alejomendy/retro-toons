import { NextRequest, NextResponse } from "next/server";
import { getStremioAddon } from "@/lib/stremio/addons";

export const runtime = "nodejs";
export const revalidate = 300;

interface RouteContext {
  params: Promise<{ addon: string; path?: string[] }>;
}

/** Proxy acotado a los addons configurados; no acepta URLs arbitrarias. */
async function proxy(request: NextRequest, context: RouteContext) {
  const { addon: addonId, path = [] } = await context.params;
  const addon = getStremioAddon(addonId);
  if (!addon) return NextResponse.json({ error: "Addon desconocido" }, { status: 404 });

  const suffix = path.length
    ? `/${path.map((segment) => encodeURIComponent(segment).replace(/%3D/gi, "=")).join("/")}`
    : "/manifest.json";
  const upstreamUrl = new URL(`${addon.baseUrl}${suffix}`);
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/json", "User-Agent": "RetroToons/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": upstream.ok ? "public, s-maxage=300, stale-while-revalidate=600" : "no-store",
        "X-RetroToons-Addon": addon.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de conexión";
    return NextResponse.json({ error: `${addon.name}: ${message}` }, { status: 502 });
  }
}

export const GET = proxy;
