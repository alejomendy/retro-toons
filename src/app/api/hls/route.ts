import type { NextRequest } from "next/server";

/**
 * GET /api/hls?u=<url .m3u8 de Pluto TV>
 *
 * Pluto TV solo permite leer sus listas HLS desde pluto.tv (CORS), pero sus
 * segmentos de video sí aceptan cualquier origen. Este proxy trae solo las
 * listas .m3u8 y reescribe sus URIs: las sub-listas vuelven a pasar por acá y
 * los segmentos van directo de Pluto al navegador (no gastan nuestro ancho de banda).
 */
const ALLOWED = /(^|\.)(pluto\.tv|plutotv\.net)$/;

function proxied(url: string): string {
  return `/api/hls?u=${encodeURIComponent(url)}`;
}

function rewrite(playlist: string, base: string): string {
  const absolute = (uri: string) => new URL(uri, base).toString();
  const route = (uri: string) => {
    const abs = absolute(uri);
    return new URL(abs).pathname.endsWith(".m3u8") ? proxied(abs) : abs;
  };
  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // Atributos URI="..." (audio, subtítulos, claves)
      if (trimmed.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${route(uri)}"`);
      return route(trimmed);
    })
    .join("\n");
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
  let url: URL;
  try {
    url = new URL(target ?? "");
  } catch {
    return new Response("URL inválida", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.test(url.hostname)) {
    return new Response("Origen no permitido", { status: 403 });
  }

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return new Response("No se pudo obtener la lista", { status: 502 });

  const body = await res.text();
  if (!body.startsWith("#EXTM3U")) return new Response("No es una lista HLS", { status: 502 });

  return new Response(rewrite(body, res.url), {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store",
    },
  });
}
