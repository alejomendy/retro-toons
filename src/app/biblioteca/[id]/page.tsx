import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { showById } from "@/data/shows";
import Image from "next/image";
import { getFullEpisode, getShowWithEpisodes } from "@/lib/catalog";
import TvPlayer from "@/components/TvPlayer";
import ChannelBadge from "@/components/ChannelBadge";
import ShowCover from "@/components/ShowCover";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const show = showById[(await params).id];
  return { title: show ? `${show.title} — RetroToons` : "RetroToons" };
}

export default async function ShowPage({ params, searchParams }: { params: Params; searchParams: Promise<{ ep?: string }> }) {
  const { id } = await params;
  const show = showById[id];
  if (!show) notFound();

  const requested = Number((await searchParams).ep);
  const epNumber = Number.isInteger(requested) && requested >= 1 && requested <= show.episodeCount ? requested : 1;
  const [{ extras, episodes }, episode] = await Promise.all([getShowWithEpisodes(show), getFullEpisode(show, epNumber)]);

  return (
    <div className="space-y-6">
      <Link href="/biblioteca" className="inline-flex items-center gap-1 font-bold text-accent hover:underline">
        <ArrowLeft className="size-4" /> Volver a la biblioteca
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <TvPlayer key={epNumber} source={episode.source} title={show.title} subtitle={episode.title} />
          <div className="flex justify-between gap-3">
            <EpisodeNav show={show.id} target={epNumber - 1} disabled={epNumber <= 1}>
              <ChevronLeft className="size-4" /> Anterior
            </EpisodeNav>
            <EpisodeNav show={show.id} target={epNumber + 1} disabled={epNumber >= show.episodeCount}>
              Siguiente <ChevronRight className="size-4" />
            </EpisodeNav>
          </div>

          {(episode.summary || episode.airdate) && (
            <div className="chunky rounded-xl bg-panel p-4">
              <p className="font-display text-lg text-white">{episode.title}</p>
              {episode.airdate && <p className="font-mono text-xl text-white/60">Emitido el {episode.airdate}</p>}
              {episode.summary && <p className="mt-1 text-sm text-white/80">{episode.summary}</p>}
            </div>
          )}

          <div className="chunky relative flex flex-col gap-4 overflow-hidden rounded-xl bg-panel sm:flex-row">
            {extras.backdrop && (
              <Image src={extras.backdrop} alt="" fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover opacity-15" />
            )}
            {extras.image ? (
              <Image src={extras.image} alt={`Póster de ${show.title}`} width={224} height={315} className="relative h-auto w-full object-cover sm:w-56 sm:shrink-0" />
            ) : (
              <ShowCover show={show} className="sm:w-56 sm:shrink-0" />
            )}
            <div className="relative space-y-2 p-4">
              <h1 className="font-display text-2xl text-accent">{show.title}</h1>
              <p className="text-sm italic text-white/60">
                {show.originalTitle}
                {extras.localTitle && extras.localTitle !== show.title && ` · En Latinoamérica: ${extras.localTitle}`}
              </p>
              <div className="flex flex-wrap gap-1">{show.channels.map((c) => <ChannelBadge key={c} id={c} />)}</div>
              <p className="font-mono text-xl text-white/70">
                {show.year} · {show.genre} · {show.seasons} temporadas · {show.episodeCount} episodios
              </p>
              <p>{show.description}</p>
              {extras.summary && <p className="text-sm text-white/70" lang={extras.summarySource === "tvmaze" ? "en" : "es"}>{extras.summary}</p>}
            </div>
          </div>

          {extras.providers.length > 0 && (
            <div className="chunky rounded-xl bg-panel p-4">
              <h2 className="font-display text-lg text-white">Dónde verla legalmente</h2>
              <ul className="mt-2 flex flex-wrap gap-3">
                {extras.providers.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 rounded-lg bg-black/40 py-1 pl-1 pr-3 text-sm">
                    <Image src={p.logo} alt="" width={32} height={32} className="rounded" />
                    {p.name}
                  </li>
                ))}
              </ul>
              {extras.providersLink && (
                <a href={extras.providersLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-white/50 underline">
                  Ver más opciones (JustWatch vía TMDB)
                </a>
              )}
            </div>
          )}

          {extras.videos.length > 0 && (
            <div className="chunky rounded-xl bg-panel p-4">
              <h2 className="font-display text-lg text-white">Openings y trailers</h2>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {extras.videos.slice(0, 4).map((v) => (
                  <li key={v.key}>
                    <iframe
                      className="aspect-video w-full rounded-lg border-2 border-black"
                      src={`https://www.youtube-nocookie.com/embed/${v.key}`}
                      title={v.name}
                      loading="lazy"
                      allowFullScreen
                    />
                    <p className="mt-1 truncate text-xs text-white/60">{v.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex flex-wrap gap-x-3 text-xs text-white/50">
            <span>Datos:</span>
            {extras.tmdbId && (
              <a href={`https://www.themoviedb.org/tv/${extras.tmdbId}`} target="_blank" rel="noreferrer" className="underline">
                TMDB (este producto usa la API de TMDB pero no está avalado por TMDB)
              </a>
            )}
            {extras.wikipediaUrl && (
              <a href={extras.wikipediaUrl} target="_blank" rel="noreferrer" className="underline">Wikipedia (CC BY-SA)</a>
            )}
            {show.tvmazeId && (
              <a href={`https://www.tvmaze.com/shows/${show.tvmazeId}`} target="_blank" rel="noreferrer" className="underline">TVmaze (CC BY-SA)</a>
            )}
          </p>
        </section>

        <aside className="chunky flex max-h-[640px] flex-col overflow-hidden rounded-xl bg-panel">
          <h2 className="border-b-4 border-black bg-black px-4 py-2 font-display text-lg text-accent">
            Episodios <span className="font-mono text-xl text-white/60">({show.episodeCount})</span>
          </h2>
          <ol className="flex-1 overflow-y-auto">
            {episodes.map((e) => {
              const active = e.number === epNumber;
              return (
                <li key={e.number}>
                  <Link
                    href={`/biblioteca/${show.id}?ep=${e.number}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={`flex items-center gap-3 px-4 py-2 hover:bg-white/10 ${active ? "bg-[#ff3ea5]/30" : ""}`}
                  >
                    <span className="w-10 font-mono text-2xl leading-none text-accent">{String(e.number).padStart(2, "0")}</span>
                    <span className="flex-1 truncate">{e.title}</span>
                    {active ? <Play className="size-4 fill-current" /> : <span className="text-xs text-white/50">{e.minutes}′</span>}
                    {!e.source && <span className="sr-only">(sin video cargado)</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function EpisodeNav({ show, target, disabled, children }: { show: string; target: number; disabled: boolean; children: React.ReactNode }) {
  const cls = "chunky inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-bold text-black";
  if (disabled) return <span className={`${cls} pointer-events-none opacity-40`}>{children}</span>;
  return <Link href={`/biblioteca/${show}?ep=${target}`} scroll={false} className={cls}>{children}</Link>;
}
