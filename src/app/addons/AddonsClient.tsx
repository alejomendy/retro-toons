"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Loader2, Play } from "lucide-react";
import { STREMIO_ADDONS, type StremioAddonId } from "@/lib/stremio/addons";
import dynamic from "next/dynamic";

/** Trae hls.js (~150 kB): se baja solo si se abre la pestaña. */
const TorrentioExplorer = dynamic(() => import("@/components/TorrentioExplorer"), {
  loading: () => <p className="flex items-center gap-2 py-6 text-white/70"><Loader2 className="size-5 animate-spin" /> Cargando…</p>,
});
import type { StremioCatalogResponse, StremioManifest, StremioMetaPreview } from "@/lib/stremio/types";

type AddonId = StremioAddonId;
const ADDONS = Object.values(STREMIO_ADDONS).filter((item) => item.visible);
const PAGE_SIZE = 20;

/** Lo que RetroToons sabe de cada título del addon: ficha en español (TMDB) y dónde verlo. */
interface Local {
  name: string | null;
  overview: string | null;
  poster: string | null;
  background: string | null;
  year: number | null;
  watch: { href: string; title: string } | null;
}
type Item = StremioMetaPreview & { local?: Local };

/** Los addons publican sus catálogos en inglés: nombres en español latino para la interfaz. */
const CATALOG_NAMES: Record<string, string> = {
  "Popular Animation": "Animación popular",
  "Classic Cartoons": "Dibujos clásicos",
  "Animated Series": "Series animadas",
};

function proxyUrl(addon: AddonId, path: string) {
  return `/api/stremio/${addon}/${path.replace(/^\//, "")}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String(data.error) : `Error HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

/** Ficha en español y disponibilidad en RetroToons de un lote de títulos. */
async function localize(items: StremioMetaPreview[]): Promise<Item[]> {
  if (items.length === 0) return [];
  const res = await readJson<{ results: Record<string, Local> }>("/api/disponibles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((item) => ({ id: item.id, name: item.name })) }),
  }).catch(() => ({ results: {} as Record<string, Local> }));
  return items.map((item) => ({ ...item, local: res.results[item.id] }));
}

const titleOf = (item: Item) => item.local?.name || item.name;

export default function AddonsClient() {
  const [selected, setSelected] = useState<AddonId>(ADDONS[0].id);
  const [manifest, setManifest] = useState<StremioManifest | null>(null);
  const [catalogId, setCatalogId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [detail, setDetail] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const catalogs = useMemo(() => (manifest?.catalogs ?? []).filter((catalog) => catalog.type === "movie" || catalog.type === "series"), [manifest]);

  useEffect(() => {
    if (selected === "torrentio") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setItems([]);
    readJson<StremioManifest>(proxyUrl(selected, "manifest.json"))
      .then((result) => {
        if (cancelled) return;
        setManifest(result);
        // Primero las series: es lo que la biblioteca de RetroToons puede reproducir.
        const first = result.catalogs?.find((catalog) => catalog.type === "series") ?? result.catalogs?.find((catalog) => catalog.type === "movie");
        setCatalogId(first ? `${first.type}::${first.id}` : "");
      })
      .catch((cause) => {
        if (cancelled) return;
        setManifest(null);
        setCatalogId("");
        setError(cause instanceof Error ? cause.message : "No se pudo conectar con el addon.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const loadPage = useCallback(async (skip: number) => {
    const [type, ...rest] = catalogId.split("::");
    const id = rest.join("::");
    if (!type || !id) return;
    const current = ++requestId.current;
    if (skip > 0) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const extra = skip > 0 ? `/skip=${skip}` : "";
      const result = await readJson<StremioCatalogResponse>(proxyUrl(selected, `catalog/${type}/${encodeURIComponent(id)}${extra}.json`));
      const metas = result.metas ?? [];
      const localized = await localize(metas);
      if (current !== requestId.current) return;
      setItems((previous) => {
        const merged = skip > 0 ? [...previous, ...localized] : localized;
        return [...new Map(merged.map((item) => [item.id, item])).values()];
      });
      setHasMore(metas.length >= PAGE_SIZE);
    } catch (cause) {
      if (current !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo.");
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [catalogId, selected]);

  useEffect(() => {
    setDetail(null);
    void loadPage(0);
  }, [loadPage]);

  const visible = onlyAvailable ? items.filter((item) => item.local?.watch) : items;
  const availableCount = items.filter((item) => item.local?.watch).length;

  const tabs = (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Addons">
      {ADDONS.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={selected === item.id} onClick={() => setSelected(item.id)} className={`chunky rounded-lg px-4 py-2 font-bold ${selected === item.id ? "bg-accent text-black" : "bg-panel text-white"}`}>
          {item.name}
        </button>
      ))}
    </div>
  );

  if (selected === "torrentio") {
    return (
      <div className="space-y-4">
        {tabs}
        <TorrentioExplorer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tabs}

      {detail ? (
        <section className="space-y-4 rounded-xl border-2 border-black bg-panel p-4 shadow-[5px_5px_0_#000]">
          <button type="button" onClick={() => setDetail(null)} className="inline-flex items-center gap-2 font-bold text-accent"><ArrowLeft className="size-4" /> Volver al catálogo</button>
          <div className="relative overflow-hidden rounded-xl bg-black/30">
            {(detail.local?.background || detail.background) && <img src={detail.local?.background || detail.background} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <div className="relative flex flex-col gap-4 p-3 sm:flex-row sm:p-5">
              {(detail.local?.poster || detail.poster) && <img src={detail.local?.poster || detail.poster} alt="" className="w-32 self-start rounded-lg border-2 border-black object-cover shadow-[4px_4px_0_#000]" />}
              <div className="min-w-0 space-y-3">
                <h2 className="font-display text-3xl text-white">{titleOf(detail)}</h2>
                <p className="text-sm text-white/60">{detail.local?.year ?? detail.releaseInfo} · {detail.type === "movie" ? "Película" : "Serie"}</p>
                <p className="max-w-3xl text-sm leading-relaxed text-white/80">{detail.local?.overview || "Todavía no hay sinopsis en español."}</p>
                <p className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/75">Todavía no está en RetroToons en español latino. Cuando aparezca una fuente, este título se va a poder ver acá.</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border-2 border-black bg-panel p-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white/70">
              Catálogo
              <select aria-label="Catálogo" value={catalogId} onChange={(event) => setCatalogId(event.target.value)} className="min-w-0 rounded-lg border-2 border-black bg-white px-3 py-2 font-bold text-black" disabled={catalogs.length === 0}>
                {catalogs.length === 0 && <option value="">Sin catálogos</option>}
                {catalogs.map((catalog) => (
                  <option key={`${catalog.type}-${catalog.id}`} value={`${catalog.type}::${catalog.id}`}>
                    {(catalog.name && CATALOG_NAMES[catalog.name]) || catalog.name || catalog.id} · {catalog.type === "movie" ? "Películas" : "Series"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex shrink-0 rounded-lg border-2 border-black bg-black/40 p-1 text-sm font-bold" role="group" aria-label="Qué mostrar">
              <button type="button" aria-pressed={onlyAvailable} onClick={() => setOnlyAvailable(true)} className={`rounded-md px-3 py-1.5 ${onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}>Para ver ahora{items.length > 0 ? ` (${availableCount})` : ""}</button>
              <button type="button" aria-pressed={!onlyAvailable} onClick={() => setOnlyAvailable(false)} className={`rounded-md px-3 py-1.5 ${!onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}>Todo{items.length > 0 ? ` (${items.length})` : ""}</button>
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg border border-amber-300/30 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p>}
          {loading && items.length === 0 && <p className="flex items-center gap-2 py-10 text-white/70"><Loader2 className="size-5 animate-spin" /> Cargando catálogo…</p>}

          {visible.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visible.map((item) => {
                const poster = item.local?.poster || item.poster;
                const cardClass = `group overflow-hidden rounded-xl border-2 border-black bg-panel text-left shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${item.local?.watch ? "" : "opacity-80 hover:opacity-100"}`;
                const content = (
                  <>
                    <div className="relative aspect-[2/3] overflow-hidden bg-black/30">
                      {poster ? <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-3 text-center text-sm text-white/40">Sin póster</div>}
                      {item.local?.watch ? (
                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border-2 border-black bg-accent px-1.5 py-0.5 text-[11px] font-black uppercase text-black shadow-[2px_2px_0_#000]"><Play className="size-3 fill-current" aria-hidden /> En RetroToons</span>
                      ) : (
                        <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white/70">Solo ficha</span>
                      )}
                    </div>
                    <span className="block line-clamp-2 min-h-12 p-2.5 text-sm font-bold group-hover:text-accent">{titleOf(item)}</span>
                  </>
                );
                return item.local?.watch ? (
                  <Link key={item.id} href={item.local.watch.href} className={cardClass} aria-label={`Ver ${titleOf(item)} en RetroToons`}>{content}</Link>
                ) : (
                  <button key={item.id} type="button" onClick={() => setDetail(item)} className={cardClass}>{content}</button>
                );
              })}
            </div>
          ) : (
            !loading && items.length > 0 && (
              <p className="rounded-xl bg-panel p-6 text-center text-white/65">
                En lo cargado de este catálogo todavía no hay títulos para ver en RetroToons.
                <button type="button" onClick={() => setOnlyAvailable(false)} className="ml-1 font-bold text-accent hover:underline">Ver todo</button>
              </p>
            )
          )}

          {hasMore && items.length > 0 && (
            <div className="flex justify-center">
              <button type="button" onClick={() => void loadPage(items.length)} disabled={loadingMore} className="chunky inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-bold text-black disabled:opacity-60">
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />} Cargar más títulos
              </button>
            </div>
          )}
          <p className="text-xs text-white/40">Catálogo: {ADDONS.find((a) => a.id === selected)?.name}. Fichas en español: TMDB. «En RetroToons» = se ve en esta página en español latino.</p>
        </>
      )}
    </div>
  );
}
