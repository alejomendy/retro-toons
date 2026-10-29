"use client";

import Link from "next/link";
import { Play, RotateCcw } from "lucide-react";
import { episodeLabel, watchHref, type LcEpisode } from "@/lib/lacartoons-types";
import { useContinueWatching } from "@/lib/user-library";

/** «Reproducir»: retoma el último episodio visto de la serie o arranca por el primero. */
export default function PlayButton({ seriesId, first }: { seriesId: string; first: LcEpisode }) {
  const progress = useContinueWatching().find((p) => p.seriesId === seriesId);
  const cls =
    "chunky inline-flex items-center gap-2 rounded-xl px-5 py-3 font-display transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white motion-reduce:transition-none";

  if (!progress) {
    return (
      <Link href={watchHref(seriesId, first.id)} className={`${cls} bg-[#ff3ea5] text-white`}>
        <Play className="size-5 fill-current" /> Reproducir
      </Link>
    );
  }

  return (
    <>
      <Link href={watchHref(seriesId, progress.episodeId, progress.position)} className={`${cls} bg-[#ff3ea5] text-white`}>
        <Play className="size-5 fill-current" />
        {progress.position > 0 ? "Continuar" : "Reproducir"} {episodeLabel(progress)}
      </Link>
      {progress.episodeId !== first.id && (
        <Link href={watchHref(seriesId, first.id)} className={`${cls} bg-white text-black`}>
          <RotateCcw className="size-5" /> Desde el principio
        </Link>
      )}
    </>
  );
}
