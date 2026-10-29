"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Minimize2 } from "lucide-react";
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
  /** Enlace externo para ver el episodio cuando no hay video embebible. */
  fallback?: { label: string; url: string };
  /** Modo cine controlado desde afuera (si no, lo maneja el reproductor). */
  cinema?: boolean;
  onCinemaChange?: (cinema: boolean) => void;
  /** Canal sintonizado: número que aparece al cambiar y logo fijo en la esquina, como en la tele. */
  channel?: { number: string; name: string; color: string; ink: string };
}

export default function TvPlayer({ source, title, subtitle, startAt = 0, badge, badgeColor = "#ef4444", overlay, fallback, cinema: cinemaProp, onCinemaChange, channel }: Props) {
  // Modo cine propio, o controlado desde afuera (la programación lo mantiene entre episodios).
  const [ownCinema, setOwnCinema] = useState(false);
  const cinema = cinemaProp ?? ownCinema;
  const setCinema = useCallback(
    (next: boolean) => (onCinemaChange ? onCinemaChange(next) : setOwnCinema(next)),
    [onCinemaChange],
  );

  // Modo cine: Esc para salir y sin scroll de fondo mientras está activo.
  useEffect(() => {
    if (!cinema) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCinema(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [cinema, setCinema]);

  // Solo cambian las clases (no la estructura): el video sigue corriendo al entrar y salir.
  return (
    <div
      className={cinema ? "fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-6" : undefined}
      onClick={cinema ? (e) => e.target === e.currentTarget && setCinema(false) : undefined}
      role={cinema ? "dialog" : undefined}
      aria-modal={cinema || undefined}
      aria-label={cinema ? `Modo cine: ${title}` : undefined}
    >
      <div
        className={`chunky rounded-[2rem] bg-[#3a2a1a] ${cinema ? "w-full max-w-[calc((100dvh-8.5rem)*16/9)] p-1.5 sm:p-4" : "p-3 sm:p-5"}`}
      >
        <div className="scanlines relative aspect-video overflow-hidden rounded-[1.5rem] bg-black shadow-[inset_0_0_60px_rgba(0,0,0,0.9)]">
          {overlay ?? <Screen source={source} title={title} subtitle={subtitle} startAt={startAt} fallback={fallback} />}
          {badge && (
            <span
              className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded px-2 py-0.5 font-mono text-xl text-white"
              style={{ backgroundColor: badgeColor }}
            >
              <span className="blink size-2.5 rounded-full bg-white" />
              {badge}
            </span>
          )}
          {channel && (
            <>
              <span key={channel.number} className="osd osd-flash pointer-events-none absolute right-4 top-3 z-20 font-mono text-4xl sm:text-5xl" aria-hidden>
                CH {channel.number}
              </span>
              <span
                className="pointer-events-none absolute bottom-14 right-3 z-20 rounded border-2 border-black px-2 font-display text-xs opacity-80 sm:text-sm"
                style={{ backgroundColor: channel.color, color: channel.ink }}
                aria-hidden
              >
                {channel.name}
              </span>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-white">{title}</p>
            {subtitle && <p className="truncate font-mono text-xl text-white/70">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCinema(!cinema)}
              aria-pressed={cinema}
              title={cinema ? "Salir del modo cine (Esc)" : "Modo cine: agrandar la tele"}
              className="flex items-center gap-1.5 rounded-full border-2 border-black bg-[#c9a36b] px-3 py-1 font-display text-xs text-black transition-transform hover:-translate-y-0.5"
            >
              {cinema ? <Minimize2 className="size-4" aria-hidden /> : <Clapperboard className="size-4" aria-hidden />}
              {cinema ? "Achicar" : "Modo cine"}
            </button>
            <span className="size-6 rounded-full border-2 border-black bg-[#c9a36b]" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function Screen({ source, title, subtitle, startAt, fallback }: Required<Pick<Props, "startAt" | "title">> & Pick<Props, "source" | "subtitle" | "fallback">) {
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

  if (source?.type === "hls") {
    return <HlsVideo url={source.url} start={start} pageUrl={source.pageUrl} />;
  }

  if (source?.type === "file") {
    return <FileVideo url={source.url} start={start} />;
  }

  return <NoSignal title={title} subtitle={subtitle} fallback={fallback} />;
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

/** Stream HLS (Pluto TV vía /api/hls). Safari lo reproduce nativo; el resto usa hls.js. */
function HlsVideo({ url, start, pageUrl }: { url: string; start: number; pageUrl?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroy: (() => void) | undefined;
    let cancelled = false;

    // hls.js primero: Chrome dice soportar HLS nativo pero falla con audio separado (como Pluto).
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: start > 0 ? start : -1 });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setFailed(true);
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iPhone / Safari: sin MediaSource, pero con HLS nativo.
        video.src = url;
        video.addEventListener("loadedmetadata", () => start > 0 && (video.currentTime = start), { once: true });
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, start]);

  if (failed) return <NoSignal title="No se pudo cargar el episodio" subtitle="Probá de nuevo en un rato" />;
  return (
    <>
      <video ref={ref} className="absolute inset-0 size-full bg-black" controls autoPlay playsInline />
      {pageUrl && (
        <a
          href={pageUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white/80 hover:text-white"
        >
          Transmitido por Pluto TV
        </a>
      )}
    </>
  );
}

export function NoSignal({ title, subtitle, fallback }: { title: string; subtitle?: string; fallback?: Props["fallback"] }) {
  return (
    <div className="absolute inset-0">
      <div className="static-noise absolute inset-0 opacity-60" />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="rounded-lg bg-black/75 px-6 py-4">
          <p className="font-display text-xl text-white sm:text-3xl">{title}</p>
          {subtitle && <p className="font-mono text-xl text-accent sm:text-2xl">{subtitle}</p>}
          {fallback ? (
            <>
              <p className="mt-2 font-mono text-lg text-white/60">SIN SEÑAL acá, pero la podés ver gratis:</p>
              <a
                href={fallback.url}
                target="_blank"
                rel="noreferrer"
                className="chunky mt-3 inline-block rounded-lg bg-accent px-4 py-2 font-display text-sm text-black transition-transform hover:-translate-y-0.5"
              >
                {fallback.label} ↗
              </a>
            </>
          ) : (
            <p className="mt-2 font-mono text-lg text-white/60">SIN SEÑAL · Este episodio todavía no está disponible</p>
          )}
        </div>
      </div>
    </div>
  );
}
