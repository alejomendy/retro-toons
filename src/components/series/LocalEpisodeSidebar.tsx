"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import type { Episode } from "@/lib/types";

interface Props {
  showId: string;
  episodes: Episode[];
  currentNumber: number;
  totalCount: number;
}

export default function LocalEpisodeSidebar({ showId, episodes, currentNumber, totalCount }: Props) {
  // Agrupar episodios por temporada
  const seasonsMap = useMemo(() => {
    const map = new Map<number, Episode[]>();
    for (const ep of episodes) {
      const s = ep.season || 1;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(ep);
    }
    return Array.from(map.entries())
      .map(([season, eps]) => ({ season, episodes: eps }))
      .sort((a, b) => a.season - b.season);
  }, [episodes]);

  // Temporada del episodio actualmente en reproducción
  const currentEp = episodes.find((e) => e.number === currentNumber);
  const initialSeason = currentEp?.season || seasonsMap[0]?.season || 1;
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);

  // Si cambia el episodio reproducido y pertenece a otra temporada, acompañar
  useEffect(() => {
    if (currentEp?.season) {
      setSelectedSeason(currentEp.season);
    }
  }, [currentEp?.season]);

  const activeSeasonData = seasonsMap.find((s) => s.season === selectedSeason) || seasonsMap[0];
  const seasonEpisodes = activeSeasonData?.episodes || [];

  return (
    <aside className="chunky flex max-h-[640px] flex-col overflow-hidden rounded-xl bg-panel">
      <div className="border-b-4 border-black bg-black p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-accent">
            Episodios <span className="font-mono text-xl text-white/65">({totalCount})</span>
          </h2>
          {seasonsMap.length > 1 && (
            <span className="font-mono text-sm text-accent">
              {seasonsMap.length} Temporadas
            </span>
          )}
        </div>

        {seasonsMap.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="season-select" className="sr-only">
              Elegir temporada
            </label>
            <select
              id="season-select"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="w-full rounded-lg border-2 border-black bg-white px-3 py-1.5 font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
            >
              {seasonsMap.map((s) => (
                <option key={s.season} value={s.season}>
                  Temporada {s.season} ({s.episodes.length} episodios)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ol className="flex-1 overflow-y-auto">
        {seasonEpisodes.map((e) => {
          const active = e.number === currentNumber;
          const epNumLabel = e.numberInSeason
            ? `E${String(e.numberInSeason).padStart(2, "0")}`
            : String(e.number).padStart(2, "0");

          return (
            <li key={e.number}>
              <Link
                href={`/biblioteca/${showId}?ep=${e.number}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-3 px-4 py-2 hover:bg-white/10 ${active ? "bg-[#ff3ea5]/30" : ""}`}
              >
                <span className="w-10 font-mono text-xl leading-none text-accent shrink-0">
                  {epNumLabel}
                </span>
                <span className="flex-1 truncate text-sm sm:text-base">
                  {e.title.replace(/^T\d+·E\d+\s*—\s*/, "")}
                </span>
                {active ? (
                  <Play className="size-4 fill-current shrink-0 text-accent" />
                ) : (
                  <span className="text-xs text-white/65 shrink-0">{e.minutes}′</span>
                )}
                {!e.source && <span className="sr-only">(sin video cargado)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

