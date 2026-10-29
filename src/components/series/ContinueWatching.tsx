"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Tv, X } from "lucide-react";
import { episodeLabel, watchHref } from "@/lib/lacartoons-types";
import { removeProgress, useContinueWatching } from "@/lib/user-library";
import { SectionTitle } from "@/components/PageHeader";

/** Fila «Continuar viendo». No renderiza nada si no hay episodios empezados. */
export default function ContinueWatching() {
  const items = useContinueWatching();
  if (items.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="continuar-viendo">
      <SectionTitle id="continuar-viendo">Continuar viendo</SectionTitle>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
        {items.map((p) => {
          const pct = p.duration > 0 ? Math.min(100, (p.position / p.duration) * 100) : 0;
          return (
            <li key={p.seriesId} className="relative w-64 shrink-0 snap-start sm:w-72">
              <Link
                href={watchHref(p.seriesId, p.episodeId, p.position)}
                className="chunky group flex h-full overflow-hidden rounded-xl bg-panel transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent motion-reduce:transition-none"
              >
                <div className="relative w-20 shrink-0 bg-black/50">
                  {p.poster ? (
                    <Image src={p.poster} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <Tv className="m-auto mt-6 size-8 text-white/30" aria-hidden />
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="size-7 fill-white text-white" />
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 pr-9">
                  <div className="min-w-0">
                    <p className="truncate font-bold leading-tight">{p.seriesName}</p>
                    <p className="font-mono text-lg leading-none text-accent">{episodeLabel(p)}</p>
                    <p className="truncate text-sm text-white/70">{p.episodeTitle}</p>
                  </div>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-black/60" aria-label={pct > 0 ? `${Math.round(pct)}% visto` : "Sin empezar"}>
                    <span className="block h-full bg-[#ff3ea5]" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => removeProgress(p.seriesId)}
                aria-label={`Quitar ${p.seriesName} de Continuar viendo`}
                title="Quitar"
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
