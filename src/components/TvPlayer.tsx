"use client";

import { useEffect, useRef } from "react";
import type { VideoSource } from "@/lib/types";

interface Props {
  source?: VideoSource;
  title: string;
  subtitle?: string;
  /** Segundo desde el que arranca el video (para el modo "en vivo"). */
  startAt?: number;
  /** Etiqueta en la esquina, ej. "EN VIVO" o "CN". */
  badge?: string;
  badgeColor?: string;
  /** Contenido que reemplaza la pantalla (ej. tanda publicitaria). */
  overlay?: React.ReactNode;
}

export default function TvPlayer({ source, title, subtitle, startAt = 0, badge, badgeColor = "#ef4444", overlay }: Props) {
  return (
    <div className="chunky rounded-[2rem] bg-[#3a2a1a] p-3 sm:p-5">
      <div className="scanlines relative aspect-video overflow-hidden rounded-[1.5rem] bg-black shadow-[inset_0_0_60px_rgba(0,0,0,0.9)]">
        {overlay ?? <Screen source={source} title={title} subtitle={subtitle} startAt={startAt} />}
        {badge && (
          <span
            className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded px-2 py-0.5 font-mono text-xl text-white"
            style={{ backgroundColor: badgeColor }}
          >
            <span className="blink size-2.5 rounded-full bg-white" />
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-white">{title}</p>
          {subtitle && <p className="truncate font-mono text-xl text-white/70">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-2" aria-hidden>
          <span className="size-6 rounded-full border-2 border-black bg-[#c9a36b]" />
          <span className="size-6 rounded-full border-2 border-black bg-[#c9a36b]" />
        </div>
      </div>
    </div>
  );
}

function Screen({ source, title, subtitle, startAt }: Required<Pick<Props, "startAt" | "title">> & Pick<Props, "source" | "subtitle">) {
  const start = Math.max(0, Math.floor(startAt));

  if (source?.type === "youtube") {
    const params = new URLSearchParams({ autoplay: "1", start: String(start), rel: "0", modestbranding: "1" });
    return (
      <iframe
        className="absolute inset-0 size-full"
        src={`https://www.youtube-nocookie.com/embed/${source.id}?${params}`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  if (source?.type === "dailymotion") {
    const params = new URLSearchParams({ video: source.id, startTime: String(start) });
    // Con un Player ID propio (Partner HQ) el embed es más confiable que el genérico.
    const player = process.env.NEXT_PUBLIC_DAILYMOTION_PLAYER_ID;
    return (
      <iframe
        className="absolute inset-0 size-full"
        src={`https://geo.dailymotion.com/${player ? `player/${player}.html` : "player.html"}?${params}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (source?.type === "file") {
    return <FileVideo url={source.url} start={start} />;
  }

  return <NoSignal title={title} subtitle={subtitle} />;
}

function FileVideo({ url, start }: { url: string; start: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const seek = () => {
      v.currentTime = Math.min(start, Math.max(0, v.duration - 1) || start);
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener("loadedmetadata", seek, { once: true });
  }, [url, start]);
  return <video ref={ref} className="absolute inset-0 size-full" src={url} controls autoPlay playsInline />;
}

export function NoSignal({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="absolute inset-0">
      <div className="static-noise absolute inset-0 opacity-60" />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="rounded-lg bg-black/75 px-6 py-4">
          <p className="font-display text-xl text-white sm:text-3xl">{title}</p>
          {subtitle && <p className="font-mono text-xl text-accent sm:text-2xl">{subtitle}</p>}
          <p className="mt-2 font-mono text-lg text-white/60">SIN SEÑAL · cargá el video en src/data/videos.ts</p>
        </div>
      </div>
    </div>
  );
}
