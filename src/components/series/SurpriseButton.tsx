"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shuffle } from "lucide-react";
import { seriesHref, watchHref, type LcEpisode, type LcSeriesSummary } from "@/lib/lacartoons-types";
import { useContinueWatching, useFavorites } from "@/lib/user-library";

const pickOne = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/**
 * «Ponete algo»: elige un episodio al azar de tus favoritos (o de lo que venías viendo,
 * o del catálogo si todavía no guardaste nada) y lo pone.
 */
export default function SurpriseButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const favorites = useFavorites();
  const watching = useContinueWatching();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function surprise() {
    setBusy(true);
    setError("");
    try {
      let candidates = [...new Set([...favorites.map((f) => f.id), ...watching.map((w) => w.seriesId)])];
      if (candidates.length === 0) {
        const res = await fetch("/api/series").then((r) => r.json());
        candidates = ((res.results ?? []) as LcSeriesSummary[]).map((s) => s.id);
      }
      const id = pickOne(candidates);
      if (!id) throw new Error();
      // Series de otras fuentes (YouTube oficial / Pluto TV): se abre su página.
      if (!id.startsWith("lacart_")) {
        router.push(seriesHref(id));
        return;
      }
      const res = await fetch(`/api/series/${encodeURIComponent(id)}`).then((r) => r.json());
      const episode = pickOne((res.series?.videos ?? []) as LcEpisode[]);
      router.push(episode ? watchHref(id, episode.id) : seriesHref(id));
    } catch {
      setError("No pudimos elegir nada ahora. Probá de nuevo.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={surprise}
        disabled={busy}
        className={`chunky inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-display text-black transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-70 ${className}`}
        title="Elige un episodio al azar de tus favoritos"
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Shuffle className="size-5" aria-hidden />}
        {busy ? "Buscando algo…" : "Ponete algo"}
      </button>
      {error && (
        <span role="alert" className="text-sm text-[#ff7cc4]">
          {error}
        </span>
      )}
    </span>
  );
}
