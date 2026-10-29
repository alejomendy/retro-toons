"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clapperboard, ListVideo, Minimize2, Play, X } from "lucide-react";
import VideoPlayer from "@/components/LazyVideoPlayer";
import EpisodeBrowser from "@/components/series/EpisodeBrowser";
import FavoriteButton from "@/components/series/FavoriteButton";
import { episodeLabel, seriesHref, watchHref, type LcEpisode } from "@/lib/lacartoons-types";
import { getSeriesProgress, isFinished, recordFinishedEpisode, removeProgress, saveProgress, useMarathon } from "@/lib/user-library";
import { theaterBand, theaterWidth, useTheaterMode } from "@/lib/use-theater";
import { prefetchStreams } from "@/lib/prefetch-streams";

const NEXT_COUNTDOWN_SECONDS = 8;

interface Props {
  series: { id: string; name: string; poster: string | null };
  videos: LcEpisode[];
  index: number;
  startAt: number;
  autoPlay: boolean;
}

export default function WatchClient({ series, videos, index, startAt, autoPlay }: Props) {
  const router = useRouter();
  const episode = videos[index];
  const prev = index > 0 ? videos[index - 1] : undefined;
  const next = index < videos.length - 1 ? videos[index + 1] : undefined;

  const [countdown, setCountdown] = useState<number | null>(null);
  const [cinema, setCinema] = useTheaterMode();
  const finishedRef = useRef(new Set<string>());
  const marathon = useMarathon();
  const marathonHere = marathon && marathon.seriesId === series.id && marathon.count >= 2 ? marathon.count : 0;
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  // Al entrar a un episodio sin ?t, ofrecer seguir desde donde quedó (localStorage solo en el cliente).
  useEffect(() => {
    setCountdown(null);
    const saved = startAt > 0 ? undefined : getSeriesProgress(series.id);
    setResumeAt(saved && saved.episodeId === episode.id && saved.position > 10 ? saved.position : null);
  }, [episode.id, series.id, startAt]);

  const handleProgress = useCallback(
    (episodeId: string, position: number, duration: number) => {
      const i = videos.findIndex((v) => v.id === episodeId);
      if (i < 0) return;
      const ep = videos[i];
      const following = videos[i + 1];
      if (isFinished(position, duration)) {
        // Cuenta para la maratón y los logros (una vez por episodio).
        if (!finishedRef.current.has(episodeId)) {
          finishedRef.current.add(episodeId);
          recordFinishedEpisode(series.id, series.name);
        }
        // Terminado: "Continuar viendo" pasa al siguiente episodio, o se quita si era el último.
        if (following) {
          saveProgress({ ...entryFor(series, following), position: 0, duration: 0 });
        } else {
          removeProgress(series.id);
        }
        return;
      }
      if (position < 5) return; // Apenas empezado: no vale la pena guardarlo.
      saveProgress({ ...entryFor(series, ep), position, duration });
    },
    [series, videos],
  );

  const handleEnded = useCallback(
    (episodeId: string) => {
      if (episodeId === episode.id && next) setCountdown(NEXT_COUNTDOWN_SECONDS);
    },
    [episode.id, next],
  );

  // Mientras se ve un episodio, se dejan listas las fuentes del siguiente.
  useEffect(() => {
    if (!next) return;
    const timer = window.setTimeout(() => prefetchStreams(next.id), 15_000);
    return () => window.clearTimeout(timer);
  }, [next]);

  const goNext = useCallback(() => {
    if (!next) return;
    setCountdown(null);
    router.push(`${watchHref(series.id, next.id)}&auto=1`, { scroll: false });
  }, [next, router, series.id]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      goNext();
      return;
    }
    const timer = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, goNext]);

  return (
    <div className="space-y-5">
      <Link
        href={seriesHref(series.id)}
        className="inline-flex items-center gap-1 font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        <ArrowLeft className="size-4" /> {series.name}
      </Link>

      {/* Modo cine: el reproductor toma todo el ancho y la lista baja (mismo árbol: el video no se corta). */}
      <div className={cinema ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
        <section className="min-w-0 space-y-4">
          <div className={cinema ? theaterBand : "relative"}>
            <div className={cinema ? `relative ${theaterWidth}` : "contents"}>
            <VideoPlayer
              episodeId={episode.id}
              startAt={startAt}
              autoPlay={autoPlay}
              onProgress={handleProgress}
              onEnded={handleEnded}
            />

            {countdown !== null && next && (
              <div className="absolute inset-x-3 bottom-16 z-20 ml-auto max-w-sm rounded-xl border-4 border-black bg-panel p-4 shadow-[5px_5px_0_#000]" role="dialog" aria-label="Siguiente episodio">
                <p className="font-mono text-lg text-white/70">Siguiente en {countdown}…</p>
                <p className="font-bold leading-tight">
                  {episodeLabel(next)} · {next.title}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={goNext}
                    autoFocus
                    className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-[#ff3ea5] px-3 py-1.5 font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                  >
                    <Play className="size-4 fill-current" /> Ver ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountdown(null)}
                    className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white px-3 py-1.5 font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                  >
                    <X className="size-4" /> Cancelar
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {resumeAt !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-black bg-accent/15 px-3 py-2 text-sm">
              <span className="flex-1">Te quedaste en {formatTime(resumeAt)}.</span>
              <button
                type="button"
                onClick={() => {
                  setResumeAt(null);
                  router.replace(watchHref(series.id, episode.id, resumeAt), { scroll: false });
                }}
                className="rounded-md border-2 border-black bg-accent px-2 py-1 font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
              >
                Continuar desde ahí
              </button>
              <button type="button" onClick={() => setResumeAt(null)} className="font-bold text-white/70 underline hover:text-white">
                Empezar de cero
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {marathonHere > 0 && (
                <p className="sticker mb-2 inline-block rounded-md bg-[#ff3ea5] px-2 py-0.5 font-mono text-lg text-white">
                  🔥 Maratón: {marathonHere} episodios seguidos
                </p>
              )}
              <p className="font-mono text-xl text-accent">
                {episode.season === 0 ? "Especial" : `Temporada ${episode.season}`} · Episodio {episode.episode}
              </p>
              <h1 className="font-display text-2xl leading-tight text-white sm:text-3xl">{episode.title}</h1>
              {episode.overview && <p className="mt-2 max-w-2xl text-white/75">{episode.overview}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCinema(!cinema)}
                aria-pressed={cinema}
                title={cinema ? "Salir del modo cine (Esc)" : "Modo cine: agrandar el reproductor"}
                className="chunky inline-flex items-center gap-2 rounded-xl bg-[#c9a36b] px-4 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              >
                {cinema ? <Minimize2 className="size-5" /> : <Clapperboard className="size-5" />}
                {cinema ? "Achicar" : "Modo cine"}
              </button>
              <FavoriteButton id={series.id} name={series.name} poster={series.poster} />
            </div>
          </div>

          <nav className="flex items-center justify-between gap-2 sm:gap-3" aria-label="Navegación entre episodios">
            <EpisodeNav target={prev} seriesId={series.id} label="Episodio anterior">
              <ChevronLeft className="size-4" /> <span className="sm:hidden">Anterior</span><span className="hidden sm:inline">Episodio anterior</span>
            </EpisodeNav>
            <a
              href="#lista-episodios"
              className="chunky inline-flex items-center gap-1 rounded-lg bg-panel px-3 py-1.5 font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent lg:hidden"
            >
              <ListVideo className="size-4" /> <span className="sr-only sm:not-sr-only">Episodios</span>
            </a>
            <EpisodeNav target={next} seriesId={series.id} label="Siguiente episodio">
              <span className="sm:hidden">Siguiente</span><span className="hidden sm:inline">Siguiente episodio</span> <ChevronRight className="size-4" />
            </EpisodeNav>
          </nav>
        </section>

        <aside id="lista-episodios" className="chunky flex max-h-[680px] flex-col overflow-hidden rounded-xl bg-panel" aria-label="Lista de episodios">
          <h2 className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-2 font-display text-lg text-accent">
            Episodios <span className="font-mono text-xl text-white/65">{index + 1}/{videos.length}</span>
          </h2>
          <div className="flex-1 overflow-y-auto p-2">
            <EpisodeBrowser seriesId={series.id} videos={videos} currentId={episode.id} variant="list" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function EpisodeNav({ target, seriesId, label, children }: { target?: LcEpisode; seriesId: string; label: string; children: React.ReactNode }) {
  const cls = "chunky inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-bold text-black";
  if (!target) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-40`} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={watchHref(seriesId, target.id)}
      scroll={false}
      title={`${label}: ${target.title}`}
      className={`${cls} transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent`}
    >
      {children}
    </Link>
  );
}

function entryFor(series: Props["series"], ep: LcEpisode) {
  return {
    seriesId: series.id,
    seriesName: series.name,
    poster: series.poster,
    episodeId: ep.id,
    episodeTitle: ep.title,
    season: ep.season,
    episode: ep.episode,
  };
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
