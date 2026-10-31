"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw } from "lucide-react";
import { STREMIO_ADDONS, type StremioAddonId } from "@/lib/stremio/addons";
import type { AddonTitle, StremioManifest } from "@/lib/stremio/types";
import { SeriesCardSkeleton, SeriesGrid } from "@/components/series/SeriesCard";
import AddonTitleCard from "@/components/series/AddonTitleCard";

/** Trae hls.js (~150 kB): se baja solo si se abre la pestaña. */
const TorrentioExplorer = dynamic(() => import("@/components/TorrentioExplorer"), {
  loading: () => (
    <p className="flex items-center gap-2 py-6 text-white/70">
      <Loader2 className="size-5 animate-spin" /> Cargando…
    </p>
  ),
});

type Catalog = NonNullable<StremioManifest["catalogs"]>[number];
const ADDONS = Object.values(STREMIO_ADDONS).filter((addon) => addon.tab !== null);
const PAGE_SIZE = 20;

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String(data.error) : `Error HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

/** Catálogos navegables: los que no piden búsqueda ni otro dato obligatorio. */
function browsable(catalog: Catalog): boolean {
  if (catalog.type !== "movie" && catalog.type !== "series") return false;
  return !(catalog.extra ?? []).some((e) => e.isRequired || e.name === "search" || e.name.endsWith("Ids"));
}

/** Los addons publican sus catálogos en inglés: nombres en español latino para la interfaz. */
const CATALOG_NAMES: Record<string, string> = {
  "Popular Animation": "Animación popular",
  "Classic Cartoons": "Dibujos clásicos",
  "Animated Series": "Series animadas",
};

const catalogKey = (c: Catalog) => `${c.type}::${c.id}`;

/** Explorador de todos los catálogos de los addons de Stremio. */
export default function AddonsClient() {
  const [selected, setSelected] = useState<StremioAddonId>(ADDONS[0].id);
  const [manifest, setManifest] = useState<StremioManifest | null>(null);
  const [catalogId, setCatalogId] = useState("");
  const [items, setItems] = useState<AddonTitle[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // Primero lo que se puede ver acá: el resto queda a un clic.
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const addon = useMemo(() => ADDONS.find((item) => item.id === selected)!, [selected]);
  const catalogs = useMemo(() => (manifest?.catalogs ?? []).filter(browsable), [manifest]);
  const catalog = catalogs.find((c) => catalogKey(c) === catalogId);
  const availableCount = items.filter((t) => t.lacartoons).length;
  const visible = onlyAvailable ? items.filter((t) => t.lacartoons) : items;

  useEffect(() => {
    if (addon.tab !== "catalog") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    setManifest(null);
    readJson<StremioManifest>(`/api/stremio/${selected}/manifest.json`, controller.signal)
      .then((result) => {
        setManifest(result);
        // Primero un catálogo de series: es lo que la biblioteca puede reproducir.
        const first = result.catalogs?.find((c) => browsable(c) && c.type === "series") ?? result.catalogs?.find(browsable);
        setCatalogId(first ? catalogKey(first) : "");
        if (!first) setLoading(false);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setCatalogId("");
        setLoading(false);
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el addon");
      });
    return () => controller.abort();
  }, [selected, addon.tab]);

  const load = useCallback(
    async (skip: number) => {
      if (!catalog) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (skip === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const url = new URLSearchParams({ addon: selected, type: catalog.type, catalog: catalog.id, skip: String(skip) });
        const { results } = await readJson<{ results: AddonTitle[] }>(`/api/addons?${url}`, controller.signal);
        setItems((prev) => {
          const base = skip === 0 ? [] : prev;
          const known = new Set(base.map((t) => `${t.type}:${t.id}`));
          return [...base, ...results.filter((t) => !known.has(`${t.type}:${t.id}`))];
        });
        setHasMore(results.length >= PAGE_SIZE);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (skip === 0) setItems([]);
        setHasMore(false);
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [catalog, selected],
  );

  useEffect(() => {
    void load(0);
    return () => abortRef.current?.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Addons">
        {ADDONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected === item.id}
            onClick={() => setSelected(item.id)}
            className={`chunky rounded-lg px-4 py-2 font-bold ${selected === item.id ? "bg-accent text-black" : "bg-panel text-white"}`}
          >
            {item.name}
          </button>
        ))}
      </div>

      {addon.tab === "torrentio" ? (
        <TorrentioExplorer />
      ) : (
        <>
          {manifest && (
            <div className="chunky flex flex-wrap items-center gap-3 rounded-xl bg-panel p-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-bold">{manifest.name}</p>
                <p className="text-sm text-white/60">{manifest.description || `Versión ${manifest.version}`}</p>
              </div>
              <select
                aria-label="Catálogo"
                value={catalogId}
                onChange={(event) => setCatalogId(event.target.value)}
                className="w-full max-w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:w-auto"
                disabled={catalogs.length === 0}
              >
                {catalogs.length === 0 && <option value="">No declara catálogos</option>}
                {catalogs.map((c) => (
                  <option key={catalogKey(c)} value={catalogKey(c)}>
                    {((c.name && CATALOG_NAMES[c.name]) || c.name || c.id) +
                      (catalogs.filter((o) => o.name === c.name).length > 1 ? ` (${c.type === "movie" ? "películas" : "series"})` : "")}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void load(0)} className="rounded-lg bg-white p-2.5 font-bold text-black" aria-label="Actualizar catálogo">
                <RefreshCw className="size-4" />
              </button>
              <div className="flex w-full rounded-lg border-2 border-black bg-black/40 p-1 text-sm font-bold sm:w-auto" role="group" aria-label="Qué mostrar">
                <button
                  type="button"
                  aria-pressed={onlyAvailable}
                  onClick={() => setOnlyAvailable(true)}
                  className={`flex-1 rounded-md px-3 py-1.5 sm:flex-none ${onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}
                >
                  Para ver ahora{items.length > 0 ? ` (${availableCount})` : ""}
                </button>
                <button
                  type="button"
                  aria-pressed={!onlyAvailable}
                  onClick={() => setOnlyAvailable(false)}
                  className={`flex-1 rounded-md px-3 py-1.5 sm:flex-none ${!onlyAvailable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}
                >
                  Todo{items.length > 0 ? ` (${items.length})` : ""}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-400/50 bg-red-950/40 p-3 text-red-200">
              {error}
            </p>
          )}

          {loading ? (
            <>
              <p className="flex items-center gap-2 text-white/70">
                <Loader2 className="size-4 animate-spin" /> Consultando {addon.name}…
              </p>
              <SeriesGrid>
                {Array.from({ length: 8 }, (_, i) => (
                  <li key={i}>
                    <SeriesCardSkeleton />
                  </li>
                ))}
              </SeriesGrid>
            </>
          ) : visible.length > 0 ? (
            <>
              <SeriesGrid>
                {visible.map((t) => (
                  <li key={`${t.type}:${t.id}`}>
                    <AddonTitleCard title={t} />
                  </li>
                ))}
              </SeriesGrid>
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void load(items.length)}
                    disabled={loadingMore}
                    className="chunky inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 className="size-4 animate-spin" />}
                    Cargar más
                  </button>
                </div>
              )}
            </>
          ) : (
            manifest &&
            !error && (
              <p className="rounded-xl bg-panel p-5 text-white/60">
                {items.length > 0
                  ? "En lo cargado de este catálogo todavía no hay títulos para ver en RetroToons."
                  : "Este catálogo no devolvió títulos. Probá otro catálogo o addon."}
                {items.length > 0 && (
                  <button type="button" onClick={() => setOnlyAvailable(false)} className="ml-1 font-bold text-accent hover:underline">
                    Ver todo
                  </button>
                )}
                {items.length > 0 && hasMore && (
                  <button type="button" onClick={() => void load(items.length)} className="ml-2 font-bold text-accent hover:underline">
                    Cargar más
                  </button>
                )}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
