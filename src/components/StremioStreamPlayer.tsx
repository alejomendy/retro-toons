"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Props = { url: string; title?: string; subtitles?: Array<{ id: string; url: string; lang: string }> };

/** Reproductor web para fuentes HTTP(S) directas devueltas por addons Stremio. */
export default function StremioStreamPlayer({ url, title, subtitles = [] }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    let hls: Hls | null = null;

    if (/\.m3u8(?:$|\?)/i.test(url) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError("No se pudo cargar esta transmisión HLS en el navegador.");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") && /\.m3u8(?:$|\?)/i.test(url)) {
      video.src = url;
    } else {
      video.src = url;
    }

    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  return (
    <div className="space-y-2 rounded-xl bg-black p-3">
      {title && <p className="font-bold text-white">{title}</p>}
      <video ref={videoRef} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black">
        {subtitles.map((subtitle, index) => <track key={subtitle.id} kind="subtitles" src={subtitle.url} srcLang={subtitle.lang} label={subtitle.lang} default={index === 0} />)}
      </video>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p className="text-xs text-white/50">La reproducción directa requiere una URL HTTP(S) compatible y que el servidor permita solicitudes desde este sitio (CORS). Los subtítulos externos también dependen de CORS y del formato entregado.</p>
    </div>
  );
}
