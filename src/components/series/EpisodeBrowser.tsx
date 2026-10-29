"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { episodeLabel, groupBySeason, watchHref, type LcEpisode } from "@/lib/lacartoons-types";
import { useContinueWatching } from "@/lib/user-library";

/** Selector de temporada + lista de episodios. `currentId` marca el que se está viendo. */
export default function EpisodeBrowser({
  seriesId,
  videos,
  currentId,
  variant = "grid",
}: {
  seriesId: string;
  videos: LcEpisode[];
  currentId?: string;
  /** "grid": página de la serie. "list": barra lateral del reproductor. */
  variant?: "grid" | "list";
}) {
  const seasons = useMemo(() => groupBySeason(videos), [videos]);
  const initialSeason = videos.find((v) => v.id === currentId)?.season ?? seasons[0]?.season ?? 1;
  const [season, setSeason] = useState(initialSeason);
  // Al pasar a un episodio de otra temporada, la lista lo acompaña.
  useEffect(() => setSeason(initialSeason), [initialSeason]);
  const episodes = seasons.find((s) => s.season === season)?.episodes ?? [];
  const progress = useContinueWatching().find((p) => p.seriesId === seriesId);

  return (
    <div className="space-y-3">
      {seasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor={`season-${variant}`} className="text-sm font-bold text-white/80">
            Temporada
          </label>
          <select
            id={`season-${variant}`}
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-lg border-2 border-black bg-white px-3 py-1.5 font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
          >
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {s.season === 0 ? "Especiales" : `Temporada ${s.season}`} ({s.episodes.length})
              </option>
            ))}
          </select>
        </div>
      )}

      <ol className={variant === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-1"}>
        {episodes.map((e) => {
          const active = e.id === currentId;
          const inProgress = progress?.episodeId === e.id && !active ? progress : undefined;
          const pct = inProgress && inProgress.duration > 0 ? Math.min(100, (inProgress.position / inProgress.duration) * 100) : 0;
          return (
            <li key={e.id}>
              <Link
                href={watchHref(seriesId, e.id)}
                aria-current={active ? "true" : undefined}
                scroll={variant === "grid"}
                className={
                  variant === "grid"
                    ? `group flex h-full gap-3 rounded-xl border-2 border-black bg-black/30 p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${active ? "bg-[#ff3ea5]/25" : ""}`
                    : `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent ${active ? "bg-[#ff3ea5]/30" : ""}`
                }
              >
                {variant === "grid" && (
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black sm:w-36">
                    {e.thumbnail && <Image src={e.thumbnail} alt="" fill sizes="144px" className="object-cover opacity-80 transition-opacity group-hover:opacity-100" />}
                    <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play className="size-8 fill-white text-white drop-shadow" />
                    </span>
                    {pct > 0 && (
                      <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                        <span className="block h-full bg-[#ff3ea5]" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </div>
                )}
                {variant === "list" && (
                  <span className="w-9 shrink-0 font-mono text-2xl leading-none text-accent">{String(e.episode).padStart(2, "0")}</span>
                )}
                <span className="min-w-0 flex-1 self-center">
                  {variant === "grid" && <span className="block font-mono text-lg leading-none text-accent">{episodeLabel(e)}</span>}
                  <span className="line-clamp-2 leading-tight">{e.title}</span>
                  {inProgress && <span className="mt-0.5 block text-xs text-[#ff7cc4]">{inProgress.position > 0 ? "A medio ver" : "Te toca este"}</span>}
                </span>
                {active && <Play className="size-4 shrink-0 self-center fill-current" aria-label="Reproduciendo" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
