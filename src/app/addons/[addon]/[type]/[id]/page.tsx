import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { getStremioAddon } from "@/lib/stremio/addons";
import { getAddonTitle } from "@/lib/stremio/client";
import { seriesHref, watchHref } from "@/lib/lacartoons-types";
import { SeriesPoster } from "@/components/series/SeriesCard";
import FavoriteButton from "@/components/series/FavoriteButton";
import StateMessage from "@/components/series/StateMessage";

type Params = Promise<{ addon: string; type: string; id: string }>;

export const maxDuration = 60;

async function load(params: Params) {
  const { addon: addonId, type, id } = await params;
  const addon = getStremioAddon(addonId);
  if (!addon || (type !== "movie" && type !== "series")) notFound();
  const data = await getAddonTitle(addon.id, type, decodeURIComponent(id)).catch(() => undefined);
  return { addon, data };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { data } = await load(params);
  return { title: `${data?.title.name ?? "Título"} — RetroToons` };
}

/** Ficha de una serie o película de un addon de Stremio, con sus episodios para ver en LACartoons. */
export default async function AddonTitlePage({ params }: { params: Params }) {
  const { addon, data } = await load(params);
  if (data === null) notFound();
  if (!data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <StateMessage tone="error" title="No pudimos cargar el título" action={{ href: "/biblioteca", label: "Volver a la biblioteca" }}>
          {addon.name} no respondió. Probá de nuevo en un rato.
        </StateMessage>
      </div>
    );
  }

  const { title, episodes } = data;
  const firstPlayable = episodes.find((e) => e.watch);
  const playable = episodes.filter((e) => e.watch).length;

  return (
    <div className="space-y-8">
      <BackLink />

      <section className="chunky relative overflow-hidden rounded-2xl bg-panel">
        {title.background && (
          <>
            <Image src={title.background} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/85 to-panel/30" aria-hidden />
          </>
        )}
        <div className="relative grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:p-8 lg:grid-cols-[240px_1fr]">
          <div className="chunky mx-auto w-44 overflow-hidden rounded-xl sm:mx-0 sm:w-full">
            <SeriesPoster src={title.poster} name={title.name} sizes="240px" priority />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-3xl leading-tight text-accent [text-shadow:3px_3px_0_#000] sm:text-5xl">{title.name}</h1>
              <p className="mt-2 font-mono text-xl text-white/80">
                {[title.type === "movie" ? "Película" : "Serie", title.year, ...title.genres.slice(0, 3), episodes.length > 0 && `${episodes.length} episodios`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {title.description && <p className="max-w-3xl leading-relaxed text-white/85">{title.description}</p>}
            <div className="flex flex-wrap gap-3">
              {firstPlayable?.watch && (
                <Link href={watchHref(firstPlayable.watch.seriesId, firstPlayable.watch.episodeId)} className="chunky inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5">
                  <Play className="size-5 fill-current" aria-hidden /> Ver desde el principio
                </Link>
              )}
              {title.lacartoons && (
                <>
                  <Link href={seriesHref(title.lacartoons.id)} className="chunky inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5">
                    <Play className="size-5 fill-current" aria-hidden /> Ver en RetroToons
                  </Link>
                  <FavoriteButton id={title.lacartoons.id} name={title.lacartoons.name} poster={title.poster} />
                </>
              )}
            </div>
            {!title.lacartoons && playable === 0 && (
              <p className="max-w-2xl text-sm text-white/65">Este título todavía no tiene video en RetroToons: el addon solo trae su ficha.</p>
            )}
          </div>
        </div>
      </section>

      {episodes.length > 0 && (
        <section className="space-y-4" aria-labelledby="episodios">
          <h2 id="episodios" className="font-display text-2xl text-white">
            Episodios {playable > 0 && <span className="font-mono text-xl text-white/65">· {playable} para ver</span>}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {episodes.map((e, i) => {
              const body = (
                <>
                  <span className="font-mono text-xl text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-tight">{e.title}</span>
                    <span className="block text-xs text-white/60">{[e.label, e.watch ? "Ver en LACartoons" : "No está en LACartoons"].filter(Boolean).join(" · ")}</span>
                  </span>
                  {e.watch && <Play className="size-5 shrink-0 fill-current text-accent" aria-hidden />}
                </>
              );
              const cls = "chunky flex items-center gap-3 rounded-xl bg-panel p-3";
              return (
                <li key={e.id}>
                  {e.watch ? (
                    <Link href={watchHref(e.watch.seriesId, e.watch.episodeId)} className={`${cls} transition-transform hover:-translate-y-0.5`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={`${cls} opacity-60`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <p className="text-xs text-white/65">Ficha: addon {addon.name} (Stremio). Videos: LACartoons.</p>
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
