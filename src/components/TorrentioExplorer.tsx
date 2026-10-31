"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ExternalLink, Loader2, Play, Search, Magnet } from "lucide-react";
import StremioStreamPlayer from "@/components/StremioStreamPlayer";
import type { StremioCatalogResponse, StremioMetaPreview, StremioStream, StremioStreamResponse, StremioVideo } from "@/lib/stremio/types";

type MediaType = "movie" | "series";
type MetaWithVideos = StremioMetaPreview & { videos?: StremioVideo[] };

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String(data.error) : `Error HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function languageHint(stream: StremioStream) {
  const label = `${stream.name ?? ""} ${stream.title ?? ""} ${stream.description ?? ""}`.toLowerCase();
  if (/latino|latam|es-la|spanish latino|castellano latino/.test(label)) return "Posible latino";
  if (/dual[ -]?audio|multi[ -]?audio/.test(label)) return "Audio múltiple";
  if (/spanish|español|castellano/.test(label)) return "Español (variante no confirmada)";
  return "Idioma no indicado";
}

function magnetUri(stream: StremioStream) {
  if (!stream.infoHash) return null;
  const params = new URLSearchParams({ xt: `urn:btih:${stream.infoHash}` });
  if (stream.title) params.set("dn", stream.title.split("\\n")[0].slice(0, 180));
  for (const source of stream.sources ?? []) {
    if (source.startsWith("tracker:")) params.append("tr", source.slice("tracker:".length));
  }
  return `magnet:?${params.toString()}`;
}

export default function TorrentioExplorer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StremioMetaPreview[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("series");
  const [detail, setDetail] = useState<MetaWithVideos | null>(null);
  const [videos, setVideos] = useState<StremioVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StremioVideo | null>(null);
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [activeUrl, setActiveUrl] = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) {
      setError("Escribí al menos dos caracteres para buscar.");
      return;
    }
    setLoading(true);
    setError("");
    setDetail(null);
    setStreams([]);
    setActiveUrl("");
    setActiveYoutubeId(null);
    try {
      const types: MediaType[] = ["series", "movie"];
      const responses = await Promise.all(types.map((type) =>
        readJson<StremioCatalogResponse>(`/api/stremio/cinemeta/catalog/${type}/top/search=${encodeURIComponent(term)}.json`)
          .catch(() => ({ metas: [] })),
      ));
      const merged = responses.flatMap((response) => response.metas ?? []);
      const unique = Array.from(new Map(merged.map((item) => [`${item.type}:${item.id}`, item])).values());
      setResults(unique);
      if (unique.length === 0) setError("Cinemeta no encontró resultados. Probá el título original o su nombre en inglés.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo realizar la búsqueda.");
    } finally {
      setLoading(false);
    }
  };

  const loadStreams = async (type: MediaType, id: string, video?: StremioVideo) => {
    setLoading(true);
    setError("");
    setStreams([]);
    setActiveUrl("");
    setActiveYoutubeId(null);
    try {
      const result = await readJson<StremioStreamResponse>(`/api/stremio/torrentio/stream/${type}/${encodeURIComponent(id)}.json`);
      setStreams(result.streams ?? []);
      if (!(result.streams?.length)) setError("Torrentio no devolvió fuentes para este episodio. Probá otra temporada, episodio o título.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron consultar las fuentes de Torrentio.");
    } finally {
      setLoading(false);
    }
    if (video) setSelectedVideo(video);
  };

  const openTitle = async (item: StremioMetaPreview) => {
    setLoading(true);
    setError("");
    setResults([]);
    setStreams([]);
    setActiveUrl("");
    setActiveYoutubeId(null);
    setSelectedVideo(null);
    setMediaType(item.type === "movie" ? "movie" : "series");
    try {
      const response = await readJson<{ meta?: MetaWithVideos }>(`/api/stremio/cinemeta/meta/${item.type}/${encodeURIComponent(item.id)}.json`);
      const meta: MetaWithVideos = response.meta ?? item;
      setDetail(meta);
      const episodes = (meta.videos ?? [])
        .filter((video) => (video.season ?? 0) > 0)
        .map((video) => ({ ...video, title: video.title || video.name || `Episodio ${video.episode ?? ""}`.trim(), released: video.released?.slice(0, 10) }));
      setVideos(episodes);
      if (item.type === "movie") await loadStreams("movie", item.id);
      else if (episodes.length > 0) await loadStreams("series", episodes[0].id, episodes[0]);
      else setError("Cinemeta no devolvió episodios para esta serie.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los detalles.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-white/10 bg-panel p-4">
      <div>
        <h2 className="text-xl font-black">Torrentio · buscar fuentes</h2>
        <p className="mt-1 text-sm text-white/65">Buscá una serie o película por título. Cinemeta resuelve su identificador y Torrentio consulta las fuentes disponibles para cada episodio.</p>
      </div>

      {!detail && (
        <>
          <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: Los Simpson, Gravity Falls, Hey Arnold…" aria-label="Buscar serie o película" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-accent" />
            <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-bold text-black disabled:opacity-50"><Search className="size-4" /> Buscar</button>
          </form>
          {results.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((item) => <button key={`${item.type}:${item.id}`} type="button" onClick={() => void openTitle(item)} className="overflow-hidden rounded-lg bg-black/30 text-left hover:ring-2 hover:ring-accent">
              {item.poster ? <img src={item.poster} alt={`Póster de ${item.name}`} loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="flex aspect-[2/3] items-center justify-center text-white/40">Sin póster</div>}
              <span className="block p-2 text-sm font-bold">{item.name}</span>
              <span className="block px-2 pb-2 text-xs uppercase text-white/45">{item.type === "series" ? "Serie" : "Película"} · {item.releaseInfo ?? ""}</span>
            </button>)}
          </div>}
        </>
      )}

      {detail && <>
        <button type="button" onClick={() => { setDetail(null); setVideos([]); setStreams([]); setSelectedVideo(null); setActiveUrl(""); setActiveYoutubeId(null); }} className="flex items-center gap-2 font-bold text-accent"><ArrowLeft className="size-4" /> Volver a resultados</button>
        <div className="flex flex-col gap-4 sm:flex-row">
          {detail.poster && <img src={detail.poster} alt={`Póster de ${detail.name}`} className="w-32 rounded-lg object-cover" />}
          <div className="space-y-2"><h3 className="text-2xl font-black">{detail.name}</h3><p className="text-xs text-white/50">{detail.releaseInfo} · {detail.id}</p>{detail.description && <p className="max-w-3xl text-sm text-white/75">{detail.description}</p>}</div>
        </div>
        {mediaType === "series" && <div className="space-y-2">
          <h4 className="font-bold">Episodios ({videos.length})</h4>
          <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
            {videos.map((video) => <button key={video.id} type="button" onClick={() => void loadStreams("series", video.id, video)} className={`rounded-lg border p-3 text-left ${selectedVideo?.id === video.id ? "border-accent bg-accent/10" : "border-white/10 bg-black/20"}`}>
              <span className="block text-sm font-bold">{video.season != null && video.episode != null ? `T${video.season} · E${video.episode} — ` : ""}{video.title}</span>
              {video.released && <span className="text-xs text-white/45">{video.released}</span>}
            </button>)}
          </div>
        </div>}
        {selectedVideo && <p className="text-sm text-white/65">Fuentes para: <strong className="text-white">{selectedVideo.title}</strong></p>}
        {activeUrl && <StremioStreamPlayer url={activeUrl} title={activeTitle} />}
        {activeYoutubeId && <div className="overflow-hidden rounded-xl bg-black"><iframe className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeYoutubeId)}?autoplay=1`} title={activeTitle || "Video de YouTube"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}
        <div className="space-y-2">
          <h4 className="font-bold">Fuentes encontradas ({streams.length})</h4>
          {streams.length > 0 ? streams.map((stream, index) => {
            const magnet = magnetUri(stream);
            return <article key={`${stream.infoHash ?? stream.url ?? stream.name}-${index}`} className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-bold">{stream.name || `Fuente ${index + 1}`}</p><p className="whitespace-pre-line break-words text-sm text-white/70">{stream.title || stream.description || "Fuente de Torrentio"}</p></div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">{stream.infoHash ? "P2P" : stream.url ? "HTTP" : "Externa"}</span>
                  <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">{languageHint(stream)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {stream.url && <button type="button" onClick={() => { setActiveYoutubeId(null); setActiveUrl(stream.url!); setActiveTitle(stream.title || stream.name || "Torrentio"); }} className="flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-bold text-black"><Play className="size-4" /> Reproducir aquí</button>}
                {stream.ytId && <button type="button" onClick={() => { setActiveUrl(""); setActiveYoutubeId(stream.ytId!); setActiveTitle(stream.title || stream.name || "YouTube"); }} className="flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-bold text-black"><Play className="size-4" /> Reproducir aquí</button>}
                {magnet && <a href={magnet} className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-bold text-black"><Magnet className="size-4" /> Abrir magnet</a>}
                {stream.externalUrl && <a href={stream.externalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-bold text-black">Abrir fuente <ExternalLink className="size-4" /></a>}
              </div>
              {stream.infoHash && <p className="break-all text-xs text-white/45">Hash: {stream.infoHash}{stream.fileIdx != null ? ` · Archivo: ${stream.fileIdx}` : ""}. Las fuentes P2P no se reproducen directamente en el elemento video del navegador.</p>}
            </article>;
          }) : !loading && <p className="text-sm text-white/55">Todavía no hay fuentes cargadas para este elemento.</p>}
        </div>
      </>}

      {loading && <p className="flex items-center gap-2 text-sm text-white/65"><Loader2 className="size-4 animate-spin" /> Consultando metadatos y fuentes…</p>}
      {error && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{error}</p>}
      <p className="border-t border-white/10 pt-3 text-xs text-white/45">Torrentio devuelve fuentes de terceros. La lista puede incluir torrents P2P, enlaces directos o resultados sin disponibilidad. El audio y los subtítulos dependen de cada fuente; no se garantiza español latino. Los enlaces magnet requieren una aplicación compatible y no se reproducen directamente dentro de RetroToons.</p>
    </section>
  );
}
