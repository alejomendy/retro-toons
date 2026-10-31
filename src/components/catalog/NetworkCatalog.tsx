"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/PageHeader";
import { ArrowLeft, ChevronDown, Clapperboard, ExternalLink, Loader2, Play, Search, Tv } from "lucide-react";

type NetworkKey = "cartoon-network" | "disney-channel";
type NetworkShow = {
  id: number;
  name: string;
  originalName: string;
  overview: string;
  firstAirDate: string | null;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  genres: number[];
  originalLanguage: string;
  /** Página de RetroToons donde se ve en español latino (null si todavía no está). */
  watch?: { href: string; title: string } | null;
};
type Season = { number: number; episodeCount: number };
type ShowDetails = {
  id: number;
  name: string;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  seasons: Season[];
  videos: { key: string; name: string; type: string }[];
  providers: { name: string; logo: string; free: boolean }[];
  providersLink: string | null;
};
type Episode = {
  season: number;
  number: number;
  name: string | null;
  nameSpain: string | null;
  overview: string | null;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
  originalName: string | null;
};
type ApiList = { success: boolean; results?: NetworkShow[]; page?: number; totalPages?: number; totalResults?: number; totalIndexed?: number; error?: string };
type ApiDetail = { success: boolean; show?: ShowDetails; error?: string };
type ApiEpisodes = { success: boolean; episodes?: Episode[]; error?: string };
type ApiVideo = { success: boolean; video?: { id: string; title: string; channelTitle: string } | null; message?: string; language?: string };

const NETWORKS: { id: NetworkKey; label: string; accent: string; description: string }[] = [
  { id: "cartoon-network", label: "Cartoon Network", accent: "#00b8e4", description: "Clásicos y series animadas de Cartoon Network." },
  { id: "disney-channel", label: "Disney Channel", accent: "#2684ff", description: "Animación y series juveniles de Disney Channel." },
];

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error || `Error HTTP ${response.status}`);
  return body;
}

function year(date: string | null) {
  return date?.slice(0, 4) || "Año desconocido";
}

export default function NetworkCatalog() {
  const [network, setNetwork] = useState<NetworkKey>("cartoon-network");
  const [items, setItems] = useState<NetworkShow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [totalIndexed, setTotalIndexed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<NetworkShow | null>(null);
  const [details, setDetails] = useState<ShowDetails | null>(null);
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [video, setVideo] = useState<ApiVideo["video"]>(null);
  const [videoMessage, setVideoMessage] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const listRequestId = useRef(0);

  const activeNetwork = useMemo(() => NETWORKS.find((entry) => entry.id === network)!, [network]);
  const trailers = details?.videos.filter((entry) => entry.type === "Trailer" || entry.type === "Teaser").slice(0, 2) ?? [];

  const loadPage = useCallback(async (nextPage: number, target = network) => {
    const requestId = ++listRequestId.current;
    const isMore = nextPage > 1;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const result = await getJson<ApiList>(`/api/catalog/networks?network=${target}&page=${nextPage}${onlyAvailable ? "&disponibles=1" : ""}`);
      if (requestId !== listRequestId.current) return;
      if (!result.success || !result.results) throw new Error(result.error || "No se pudo cargar el catálogo.");
      setItems((previous) => {
        if (!isMore || target !== network) return result.results!;
        const ids = new Set(previous.map((item) => item.id));
        return [...previous, ...result.results!.filter((item) => !ids.has(item.id))];
      });
      setPage(result.page ?? nextPage);
      setTotalPages(result.totalPages ?? 1);
      setTotalResults(result.totalResults ?? 0);
      if (result.totalIndexed) setTotalIndexed(result.totalIndexed);
    } catch (cause) {
      if (requestId !== listRequestId.current) return;
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo.");
      if (!isMore) setItems([]);
    } finally {
      if (requestId === listRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [network, onlyAvailable]);

  useEffect(() => {
    setSelected(null);
    setDetails(null);
    setActiveEpisode(null);
    setVideo(null);
    setItems([]);
    setPage(0);
    void loadPage(1, network);
  }, [network, loadPage]);

  const openShow = async (item: NetworkShow) => {
    setSelected(item);
    setDetails(null);
    setEpisodes([]);
    setActiveEpisode(null);
    setVideo(null);
    setVideoMessage("");
    setLoading(true);
    setError("");
    try {
      const result = await getJson<ApiDetail>(`/api/catalog/series/${item.id}`);
      if (!result.success || !result.show) throw new Error(result.error || "No se pudieron cargar los detalles.");
      setDetails(result.show);
      const firstSeason = result.show.seasons.find((entry) => entry.number > 0)?.number ?? 0;
      setSeason(firstSeason);
      await loadSeason(item.id, firstSeason);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los detalles.");
    } finally {
      setLoading(false);
    }
  };

  const loadSeason = async (showId: number, seasonNumber: number) => {
    setEpisodeLoading(true);
    setEpisodes([]);
    try {
      const result = await getJson<ApiEpisodes>(`/api/catalog/series/${showId}/seasons/${seasonNumber}`);
      if (!result.success) throw new Error(result.error || "No se pudieron cargar los episodios.");
      setEpisodes(result.episodes ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los episodios.");
    } finally {
      setEpisodeLoading(false);
    }
  };

  const selectSeason = (value: number) => {
    if (!selected) return;
    setSeason(value);
    setActiveEpisode(null);
    setVideo(null);
    setVideoMessage("");
    void loadSeason(selected.id, value);
  };

  const playEpisode = async (episode: Episode) => {
    if (!selected) return;
    setActiveEpisode(episode);
    setVideo(null);
    setVideoMessage("");
    setVideoLoading(true);
    try {
      const params = new URLSearchParams({
        series: selected.name,
        original: selected.originalName,
        title: episode.name ?? `Episodio ${episode.number}`,
        season: String(episode.season),
        episode: String(episode.number),
      });
      const result = await getJson<ApiVideo>(`/api/catalog/episode-video?${params}`);
      setVideo(result.video ?? null);
      setVideoMessage(result.message ?? (result.video ? "Audio no verificado: revisá la pista antes de reproducir." : "No se encontró una fuente compatible."));
    } catch (cause) {
      setVideoMessage(cause instanceof Error ? cause.message : "No se pudo buscar el video.");
    } finally {
      setVideoLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return items;
    return items.filter((item) => `${item.name} ${item.originalName}`.toLocaleLowerCase("es").includes(needle));
  }, [items, query]);

  return (
    <section className="space-y-5" aria-labelledby="catalogo-cadenas">
      <SectionTitle
        id="catalogo-cadenas"
        aside={<span className="rounded-lg border-2 border-black bg-accent px-3 py-1 font-mono text-lg leading-tight text-black">{totalResults.toLocaleString("es-AR")} {onlyAvailable ? "para ver ahora" : "títulos"}</span>}
      >
        Cartoon Network y Disney Channel
      </SectionTitle>
      <p className="-mt-2 max-w-2xl text-white/70">Todo lo que pasaron las dos cadenas. Las marcadas <strong className="text-white">▶ En RetroToons</strong> se ven acá mismo en español latino; el resto queda como ficha.</p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Elegir cadena">
        {NETWORKS.map((entry) => (
          <button key={entry.id} type="button" role="tab" aria-selected={network === entry.id} onClick={() => setNetwork(entry.id)} className={`chunky rounded-lg px-4 py-2.5 font-bold transition-transform hover:-translate-y-0.5 ${network === entry.id ? "text-black" : "bg-panel text-white"}`} style={network === entry.id ? { backgroundColor: entry.accent } : undefined}>
            {entry.label}
          </button>
        ))}
      </div>

      {!selected ? (
        <>
          <div className="flex flex-col gap-3 rounded-xl border-2 border-black bg-panel p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 py-2 text-black">
              <Search className="size-4 shrink-0" aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Filtrar ${activeNetwork.label}…`} className="w-full bg-transparent text-sm outline-none" aria-label="Filtrar series" />
            </div>
            <div className="flex shrink-0 rounded-lg border-2 border-black bg-black/40 p-1 text-sm font-bold" role="group" aria-label="Qué mostrar">
              <button type="button" aria-pressed={onlyAvailable} onClick={() => setOnlyAvailable(true)} className={`rounded-md px-3 py-1.5 ${onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}>Para ver ahora</button>
              <button type="button" aria-pressed={!onlyAvailable} onClick={() => setOnlyAvailable(false)} className={`rounded-md px-3 py-1.5 ${!onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}>Todo el catálogo{totalIndexed ? ` (${totalIndexed})` : ""}</button>
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-amber-300/30 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
          {loading && items.length === 0 ? <div className="flex items-center gap-2 py-10 text-white/70"><Loader2 className="size-5 animate-spin" /> Cargando catálogo…</div> : null}
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredItems.map((item) => {
                const cardClass = `group overflow-hidden rounded-xl border-2 border-black bg-panel text-left shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${item.watch ? "" : "opacity-80 hover:opacity-100"}`;
                const content = (
                  <>
                    <div className="relative aspect-[2/3] overflow-hidden bg-black/30">
                      {item.poster ? <img src={item.poster.replace("/w500/", "/w342/")} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-3 text-center text-sm text-white/40">Sin póster disponible</div>}
                      <span className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-1 text-xs font-bold text-white">{year(item.firstAirDate)}</span>
                      {item.watch ? <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border-2 border-black bg-accent px-1.5 py-0.5 text-[11px] font-black uppercase text-black shadow-[2px_2px_0_#000]"><Play className="size-3 fill-current" aria-hidden /> En RetroToons</span> : <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white/70">Solo ficha</span>}
                    </div>
                    <span className="block line-clamp-2 min-h-12 p-2.5 text-sm font-bold group-hover:text-accent">{item.name}</span>
                  </>
                );
                return item.watch ? (
                  <Link key={item.id} href={item.watch.href} className={cardClass} aria-label={`Ver ${item.name} en RetroToons`}>{content}</Link>
                ) : (
                  <button key={item.id} type="button" onClick={() => void openShow(item)} className={cardClass}>{content}</button>
                );
              })}
            </div>
          ) : !loading ? <p className="rounded-xl bg-panel p-6 text-center text-white/65">{query.trim() ? "No hay títulos que coincidan con esa búsqueda." : "Todavía no hay series de esta cadena para ver en RetroToons."}{onlyAvailable && <button type="button" onClick={() => setOnlyAvailable(false)} className="ml-1 font-bold text-accent hover:underline">Ver todo el catálogo</button>}</p> : null}
          {page < totalPages && !query.trim() && <div className="flex justify-center"><button type="button" onClick={() => void loadPage(page + 1)} disabled={loadingMore} className="chunky inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-bold text-black disabled:opacity-60">{loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />} Cargar más títulos</button></div>}
        </>
      ) : (
        <div className="space-y-5 rounded-xl border-2 border-black bg-panel p-4 shadow-[5px_5px_0_#000]">
          {loading && !details && <p className="flex items-center gap-2 text-sm text-white/65"><Loader2 className="size-4 animate-spin" /> Cargando ficha de la serie…</p>}
          <button type="button" onClick={() => { setSelected(null); setDetails(null); setEpisodes([]); setActiveEpisode(null); setVideo(null); setError(""); }} className="inline-flex items-center gap-2 font-bold text-accent"><ArrowLeft className="size-4" /> Volver al catálogo</button>
          <div className="relative overflow-hidden rounded-xl bg-black/30">
            {details?.backdrop && <img src={details.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <div className="relative flex flex-col gap-4 p-3 sm:flex-row sm:p-5">
              {details?.poster || selected.poster ? <img src={details?.poster || selected.poster || ""} alt={`Póster de ${selected.name}`} className="w-32 self-start rounded-lg border-2 border-black object-cover shadow-[4px_4px_0_#000]" /> : null}
              <div className="min-w-0 space-y-2">
                <span className="inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs font-bold uppercase tracking-wide text-accent"><Tv className="size-3" /> {activeNetwork.label}</span>
                <h3 className="font-display text-3xl text-white">{details?.name || selected.name}</h3>
                <p className="text-sm text-white/60">{year(selected.firstAirDate)} · {details?.seasons.length ?? 0} temporadas</p>
                <p className="max-w-3xl text-sm leading-relaxed text-white/80">{details?.overview || selected.overview || "Sin sinopsis disponible en español."}</p>
                {selected.watch ? <Link href={selected.watch.href} className="chunky inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-bold text-black"><Play className="size-4 fill-current" /> Ver en RetroToons</Link> : <p className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/75">Todavía no está en RetroToons en español latino.</p>}
                {details?.providersLink && <a href={details.providersLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline">Dónde verla en tu región <ExternalLink className="size-3" /></a>}
              </div>
            </div>
          </div>

          {trailers.length > 0 ? (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 font-bold"><Clapperboard className="size-4 text-accent" /> Avances y material promocional</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {trailers.map((entry) => <div key={entry.key} className="overflow-hidden rounded-lg bg-black"><iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(entry.key)}`} title={entry.name} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><p className="p-2 text-xs text-white/70">{entry.name}</p></div>)}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-2xl text-white">Episodios</h4>
            <label className="flex items-center gap-2 text-sm text-white/70">Temporada
              <select value={season} onChange={(event) => selectSeason(Number(event.target.value))} disabled={!details || details.seasons.length === 0} className="rounded-lg border-2 border-black bg-white px-3 py-2 font-bold text-black">
                {(details?.seasons ?? []).filter((entry) => entry.number >= 0).map((entry) => <option key={entry.number} value={entry.number}>{entry.number === 0 ? "Especiales" : `Temporada ${entry.number}`}</option>)}
              </select>
            </label>
          </div>
          {episodeLoading ? <p className="flex items-center gap-2 text-sm text-white/65"><Loader2 className="size-4 animate-spin" /> Cargando episodios…</p> : episodes.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {episodes.map((episode) => <button key={`${episode.season}-${episode.number}`} type="button" onClick={() => void playEpisode(episode)} className={`flex min-w-0 items-start gap-3 rounded-lg border-2 p-2.5 text-left transition-colors ${activeEpisode?.number === episode.number ? "border-accent bg-accent/10" : "border-black bg-black/25 hover:bg-black/40"}`}>
                {episode.still ? <img src={episode.still} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded object-cover" /> : <span className="flex aspect-video w-28 shrink-0 items-center justify-center rounded bg-white/10"><Play className="size-5" /></span>}
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-accent">Episodio {episode.number}</span><span className="block line-clamp-2 text-sm font-bold text-white">{episode.name || episode.nameSpain || `Temporada ${episode.season} · Episodio ${episode.number}`}</span>{episode.runtime && <span className="mt-1 block text-xs text-white/45">{episode.runtime} min</span>}</span>
              </button>)}
            </div>
          ) : <p className="rounded-lg bg-black/25 p-4 text-sm text-white/60">No se encontraron episodios para esta temporada.</p>}

          {activeEpisode && <div className="space-y-3 rounded-xl border-2 border-black bg-black/35 p-3 sm:p-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-accent">Temporada {activeEpisode.season} · Episodio {activeEpisode.number}</p><h4 className="text-lg font-black text-white">{activeEpisode.name || activeEpisode.nameSpain || `Episodio ${activeEpisode.number}`}</h4></div>
            {videoLoading ? <p className="flex items-center gap-2 text-sm text-white/70"><Loader2 className="size-4 animate-spin" /> Buscando en canales configurados…</p> : video ? <>
              <div className="overflow-hidden rounded-lg bg-black"><iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
              <p className="text-sm text-white/65">{video.title} · {video.channelTitle}</p>
              <p className="text-xs text-amber-200">Idioma del audio no verificado automáticamente. Comprobalo al reproducir.</p>
            </> : <div className="rounded-lg border border-amber-300/25 bg-amber-950/20 p-3 text-sm text-amber-100">{videoMessage || "No se encontró un video coincidente."}<p className="mt-2 text-xs text-amber-100/70">La búsqueda de episodios necesita YOUTUBE_API_KEY y canales permitidos en YOUTUBE_CHANNEL_IDS. No se buscan ni se incrustan resultados arbitrarios de terceros.</p></div>}
          </div>}
          {error && <p role="alert" className="rounded-lg border border-amber-300/30 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
        </div>
      )}
      <p className="text-xs text-white/40">Fichas y arte: TMDB. «En RetroToons» = se ve en esta página en español latino.</p>
    </section>
  );
}
