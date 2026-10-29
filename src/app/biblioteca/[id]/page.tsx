import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadSeries } from "@/lib/lacartoons-page";
import { groupBySeason, lcErrorMessages } from "@/lib/lacartoons-types";
import { SeriesPoster } from "@/components/series/SeriesCard";
import FavoriteButton from "@/components/series/FavoriteButton";
import PlayButton from "@/components/series/PlayButton";
import EpisodeBrowser from "@/components/series/EpisodeBrowser";
import StateMessage from "@/components/series/StateMessage";
import { showById } from "@/data/shows";
import LocalShowPage from "./LocalShowPage";

type Params = Promise<{ id: string }>;

type Search = Promise<{ ep?: string; vivo?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const local = showById[id];
  if (local) return { title: `${local.title} — RetroToons` };
  const result = await loadSeries(id);
  return { title: result.ok ? `${result.series.name} — RetroToons` : "Serie — RetroToons" };
}

export default async function SeriePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  // Series que no están en LACartoons: se ven desde YouTube oficial / Pluto TV (biblioteca local).
  const local = showById[id];
  if (local) return <LocalShowPage show={local} query={await searchParams} />;

  const result = await loadSeries(id);

  if (!result.ok) {
    if (result.code === "SERIES_NOT_FOUND" || result.code === "INVALID_ID") notFound();
    return (
      <div className="space-y-6">
        <BackLink />
        <StateMessage tone="error" title="No pudimos cargar la serie" action={{ href: "/biblioteca", label: "Volver a la biblioteca" }}>
          {result.message}
        </StateMessage>
      </div>
    );
  }

  const { series } = result;
  const seasons = groupBySeason(series.videos);
  const first = series.videos[0];

  return (
    <div className="space-y-8">
      <BackLink />

      <section className="chunky relative overflow-hidden rounded-2xl bg-panel">
        {series.background && (
          <>
            <Image src={series.background} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/85 to-panel/30" aria-hidden />
          </>
        )}
        <div className="relative grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:p-8 lg:grid-cols-[240px_1fr]">
          <div className="chunky mx-auto w-44 overflow-hidden rounded-xl sm:mx-0 sm:w-full">
            <SeriesPoster src={series.poster} name={series.name} sizes="240px" priority />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-3xl leading-tight text-accent [text-shadow:3px_3px_0_#000] sm:text-5xl">{series.name}</h1>
              <p className="mt-2 font-mono text-xl text-white/80">
                {[
                  series.releaseInfo,
                  ...series.genres,
                  seasons.length > 0 && (seasons.length === 1 ? "1 temporada" : `${seasons.length} temporadas`),
                  series.videos.length > 0 && `${series.videos.length} episodios`,
                  series.language,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {series.description && <p className="max-w-3xl leading-relaxed text-white/85">{series.description}</p>}
            <div className="flex flex-wrap gap-3">
              {first && <PlayButton seriesId={series.id} first={first} />}
              <FavoriteButton id={series.id} name={series.name} poster={series.poster} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="episodios">
        <h2 id="episodios" className="font-display text-2xl text-white">
          Episodios
        </h2>
        {series.videos.length > 0 ? (
          <EpisodeBrowser seriesId={series.id} videos={series.videos} />
        ) : (
          <StateMessage tone="empty" title="Sin episodios">
            {lcErrorMessages.NO_EPISODES}
          </StateMessage>
        )}
      </section>

      <p className="text-xs text-white/50">Datos y videos: LACartoons (addon de Stremio).</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/biblioteca" className="inline-flex items-center gap-1 font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent">
      <ArrowLeft className="size-4" /> Volver a la biblioteca
    </Link>
  );
}
