import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Play } from "lucide-react";
import Image from "next/image";
import { getFullEpisode, getShowWithEpisodes } from "@/lib/catalog";
import TvPlayer from "@/components/TvPlayer";
import ChannelBadge from "@/components/ChannelBadge";
import ShowCover from "@/components/ShowCover";
import type { Show } from "@/lib/types";

/**
 * Página de una serie que no está en LACartoons y se ve desde fuentes legales propias
 * (canales oficiales de YouTube, Pluto TV, data/videos.ts). Es la página original de la biblioteca local.
 */
export default async function LocalShowPage({ show, query }: { show: Show; query: { ep?: string; vivo?: string } }) {
  const requested = Number(query.ep);
  const epNumber = Number.isInteger(requested) && requested >= 1 && requested <= show.episodeCount ? requested : 1;
  const [{ extras, episodes }, episode] = await Promise.all([getShowWithEpisodes(show), getFullEpisode(show, epNumber)]);
  // Canal en vivo de la serie (Pluto TV): se ve si se pide, o si el episodio no tiene video.
  const channel = extras.free.find((f) => f.kind === "canal" && f.stream);
  const live = channel && (query.vivo === "1" || !episode.source) ? channel : undefined;
  // Pluto ya tiene su propia sección arriba.
  const providers = extras.free.length > 0 ? extras.providers.filter((p) => !p.name.startsWith("Pluto")) : extras.providers;

  return (
    <div className="space-y-6">
      <Link href="/biblioteca" className="inline-flex items-center gap-1 font-bold text-accent hover:underline">
        <ArrowLeft className="size-4" /> Volver a la biblioteca
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          {live ? (
            <TvPlayer
              key="vivo"
              source={{ type: "hls", url: live.stream!, pageUrl: live.url }}
              title={`${show.title} · canal en vivo`}
              subtitle={live.now ? `Ahora: ${live.now.title}` : "En vivo en Pluto TV"}
              badge="EN VIVO"
            />
          ) : (
            <TvPlayer
              key={epNumber}
              source={episode.source}
              title={show.title}
              subtitle={episode.title}
              fallback={extras.free[0] ? { label: `Ver ${extras.free[0].kind === "canal" ? "el canal en vivo" : "la serie gratis"} en ${extras.free[0].platform}`, url: extras.free[0].url } : undefined}
            />
          )}
          {live && (
            <p className="rounded-lg bg-black/40 px-3 py-2 text-sm text-white/80">
              {episode.source ? (
                <>
                  Estás viendo el canal en vivo.{" "}
                  <Link href={`/biblioteca/${show.id}?ep=${epNumber}`} className="font-bold text-accent hover:underline">
                    Volver a {episode.title}
                  </Link>
                </>
              ) : (
                <>“{episode.title}” todavía no se puede ver acá: mientras tanto pasamos el canal de {show.title} en vivo.</>
              )}
            </p>
          )}
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
              {episode.airdate && <p className="font-mono text-xl text-white/60">Emitido el {formatAirdate(episode.airdate)}</p>}
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
              {extras.localTitle && extras.localTitle.toLowerCase() !== show.title.toLowerCase() && (
                <p className="text-sm italic text-white/60">También conocida como: {extras.localTitle}</p>
              )}
              <div className="flex flex-wrap gap-1">{show.channels.map((c) => <ChannelBadge key={c} id={c} />)}</div>
              <p className="font-mono text-xl text-white/70">
                {show.year} · {show.genre} · {show.seasons} temporadas · {show.episodeCount} episodios
              </p>
              <p>{show.description}</p>
              {extras.summary && <p className="text-sm text-white/70">{extras.summary}</p>}
            </div>
          </div>

          {extras.free.length > 0 && (
            <div className="chunky rounded-xl bg-panel p-4">
              <h2 className="font-display text-lg text-white">Gratis y legal en Pluto TV</h2>
              <p className="text-sm text-white/60">Con publicidad, sin suscripción. Los canales en vivo se ven acá mismo.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {extras.free.map((f) => (
                  <li key={f.url}>
                    <a
                      href={f.stream ? `/biblioteca/${show.id}?ep=${epNumber}&vivo=1` : f.url}
                      {...(f.stream ? {} : { target: "_blank", rel: "noreferrer" })}
                      className="flex h-full flex-col gap-1 rounded-lg border-2 border-black bg-black/40 p-3 transition-colors hover:bg-black/60"
                    >
                      <span className="flex items-center gap-2 font-bold">
                        {f.kind === "canal" ? (
                          <span className="blink rounded bg-red-500 px-1.5 font-mono text-sm text-white">EN VIVO</span>
                        ) : (
                          <span className="rounded bg-accent px-1.5 font-mono text-sm text-black">A DEMANDA</span>
                        )}
                        {f.name}
                      </span>
                      {f.now && (
                        <span className="text-sm text-white/70">
                          Ahora: {f.now.title} · hasta las {new Date(f.now.until).toLocaleTimeString("es-419", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <span className="text-xs text-accent">{f.stream ? "Ver el canal acá ▶" : f.kind === "canal" ? "Ver el canal ↗" : "Ver la serie ↗"}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {providers.length > 0 && (
            <div className="chunky rounded-xl bg-panel p-4">
              <h2 className="font-display text-lg text-white">Dónde verla legalmente</h2>
              <ul className="mt-2 flex flex-wrap gap-3">
                {providers.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 rounded-lg bg-black/40 py-1 pl-1 pr-3 text-sm">
                    <Image src={p.logo} alt="" width={32} height={32} className="rounded" />
                    {p.name}
                    {p.free && <span className="rounded bg-accent px-1 font-mono text-xs text-black">GRATIS</span>}
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
              <h2 className="font-display text-lg text-white">Presentaciones y avances</h2>
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
            {extras.credits.map((c) => (
              <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="underline">{c.name}</a>
            ))}
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

/** "1996-04-28" → "28 de abril de 1996" */
function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" });
}
