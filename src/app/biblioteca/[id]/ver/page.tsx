import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSeries } from "@/lib/lacartoons-page";
import { lcErrorMessages, seriesHref } from "@/lib/lacartoons-types";
import StateMessage from "@/components/series/StateMessage";
import WatchClient from "./WatchClient";

type Params = Promise<{ id: string }>;
type Search = Promise<{ ep?: string; t?: string; auto?: string; especial?: string }>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const [result, { ep }] = await Promise.all([loadSeries((await params).id), searchParams]);
  if (!result.ok) return { title: "Reproductor — RetroToons" };
  const episode = result.series.videos.find((v) => v.id === ep) ?? result.series.videos[0];
  return { title: episode ? `${episode.title} · ${result.series.name} — RetroToons` : `${result.series.name} — RetroToons` };
}

export default async function VerPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await loadSeries(id);

  if (!result.ok) {
    if (result.code === "SERIES_NOT_FOUND" || result.code === "INVALID_ID") notFound();
    return (
      <StateMessage tone="error" title="No pudimos cargar el episodio" action={{ href: "/biblioteca", label: "Volver a la biblioteca" }}>
        {result.message}
      </StateMessage>
    );
  }

  const { series } = result;
  if (series.videos.length === 0) {
    return (
      <StateMessage tone="empty" title="Sin episodios" action={{ href: seriesHref(series.id), label: "Volver a la serie" }}>
        {lcErrorMessages.NO_EPISODES}
      </StateMessage>
    );
  }

  // Sin ?ep se arranca por el primer episodio.
  const index = query.ep ? series.videos.findIndex((v) => v.id === query.ep) : 0;
  if (index < 0) {
    return (
      <StateMessage tone="empty" title="Episodio no encontrado" action={{ href: seriesHref(series.id), label: `Ver episodios de ${series.name}` }}>
        Ese episodio no forma parte de {series.name}.
      </StateMessage>
    );
  }

  const t = Number(query.t);
  return (
    <WatchClient
      series={{ id: series.id, name: series.name, poster: series.poster }}
      videos={series.videos}
      index={index}
      startAt={Number.isFinite(t) && t > 0 ? t : 0}
      autoPlay={query.auto === "1"}
      halloween={query.especial === "halloween"}
    />
  );
}
