import { NextRequest, NextResponse } from "next/server";
import { findAuthorizedYoutubeEpisode } from "@/lib/youtube";

export const runtime = "nodejs";
export const revalidate = 604800;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const series = params.get("series")?.trim().slice(0, 100) ?? "";
  const originalTitle = params.get("original")?.trim().slice(0, 100) || null;
  const episodeTitle = params.get("title")?.trim().slice(0, 120) || null;
  const season = Number(params.get("season"));
  const episode = Number(params.get("episode"));
  if (!series || !Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) {
    return NextResponse.json({ success: false, error: "Faltan datos válidos de serie, temporada o episodio." }, { status: 400 });
  }
  const video = await findAuthorizedYoutubeEpisode({ series, originalTitle, episodeTitle, season, episode });
  if (!video) {
    const configured = Boolean(process.env.YOUTUBE_API_KEY);
    const allowlist = Boolean(process.env.YOUTUBE_CHANNEL_IDS?.trim());
    return NextResponse.json({
      success: true,
      video: null,
      message: !configured
        ? "Configurá YOUTUBE_API_KEY para buscar videos."
        : !allowlist
          ? "Configurá YOUTUBE_CHANNEL_IDS con canales que tengas autorización para utilizar."
          : "No se encontró un episodio coincidente en los canales configurados.",
    }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  }
  return NextResponse.json({ success: true, video, language: "español no verificado" }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
