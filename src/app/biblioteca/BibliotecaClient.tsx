"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Loader2, Search, X } from "lucide-react";
import { channels } from "@/data/channels";
import SeriesCard, { SeriesCardSkeleton, SeriesGrid } from "@/components/series/SeriesCard";
import FavoriteButton from "@/components/series/FavoriteButton";
import StateMessage from "@/components/series/StateMessage";
import { lcErrorMessages, type LcErrorCode, type LcSeriesSummary } from "@/lib/lacartoons-types";
import { useFavorites } from "@/lib/user-library";

const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;
/** Valor del filtro que muestra los favoritos guardados en este navegador. */
const FAVORITES = "favoritos";

type Status = "loading" | "ready" | "error";

/** Colores de marca para las cadenas que coinciden con un canal de la programación. */
const brandByGenre = new Map(channels.map((c) => [c.name, { bg: c.color, ink: c.ink }]));

/** Pide una página del catálogo a /api/series y valida la respuesta. */
async function fetchPage(params: { q: string; genre: string; skip: number }, signal: AbortSignal): Promise<LcSeriesSummary[]> {
  const url = new URLSearchParams();
  if (params.q) url.set("q", params.q);
  if (params.genre) url.set("genre", params.genre);
  if (params.skip) url.set("skip", String(params.skip));
  const res = await fetch(`/api/series?${url}`, { signal });
  const data: unknown = await res.json().catch(() => null);
  const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok || body.success !== true || !Array.isArray(body.results)) {
    const code = typeof body.code === "string" ? (body.code as LcErrorCode) : "MALFORMED_DATA";
    throw new Error(typeof body.error === "string" ? body.error : lcErrorMessages[code] ?? lcErrorMessages.MALFORMED_DATA);
  }
  return body.results.filter(
    (r): r is LcSeriesSummary => typeof r === "object" && r !== null && typeof (r as LcSeriesSummary).id === "string" && typeof (r as LcSeriesSummary).name === "string",
  );
}

export default function BibliotecaClient({ genres }: { genres: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const favorites = useFavorites();

  const [input, setInput] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState(() => {
    const f = params.get("cadena") ?? "";
    return f === FAVORITES || genres.includes(f) ? f : "";
  });
  const [results, setResults] = useState<LcSeriesSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const showFavorites = filter === FAVORITES;
  const genre = showFavorites ? "" : filter;

  // Cada pedido nuevo invalida los anteriores (por si responden fuera de orden).
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce: solo se busca cuando el usuario deja de escribir.
  useEffect(() => {
    const trimmed = input.trim();
    const next = trimmed.length >= MIN_QUERY ? trimmed : "";
    const timer = window.setTimeout(() => setQuery(next), next === query ? 0 : DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input, query]);

  // Reflejar la búsqueda en la URL (para compartir / volver atrás).
  useEffect(() => {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (filter) url.set("cadena", filter);
    const qs = url.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, filter, pathname, router]);

  const load = useCallback(
    async (skip: number) => {
      abortRef.current?.abort();
      if (showFavorites) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++requestRef.current;

      if (skip === 0) {
        setStatus("loading");
        setError("");
      } else {
        setLoadingMore(true);
      }

      try {
        const page = await fetchPage({ q: query, genre, skip }, controller.signal);
        if (id !== requestRef.current) return;
        setResults((prev) => {
          if (skip === 0) return page;
          const known = new Set(prev.map((r) => r.id));
          return [...prev, ...page.filter((r) => !known.has(r.id))];
        });
        // La búsqueda devuelve todo junto; el catálogo navegable viene paginado.
        setHasMore(!query && page.length > 0);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted || id !== requestRef.current) return;
        if (skip === 0) {
          setStatus("error");
          setError(err instanceof Error ? err.message : lcErrorMessages.ADDON_UNREACHABLE);
        } else {
          setHasMore(false);
        }
      } finally {
        if (id === requestRef.current) setLoadingMore(false);
      }
    },
    [query, genre, showFavorites],
  );

  useEffect(() => {
    void load(0);
    return () => abortRef.current?.abort();
  }, [load]);

  // Favoritos: se filtran en el navegador por nombre.
  const q = query.toLowerCase();
  const favoriteResults = favorites.filter((f) => !q || f.name.toLowerCase().includes(q));
  const typing = input.trim() !== query && input.trim().length >= MIN_QUERY;

  return (
    <div className="space-y-5">
      <div className="chunky flex flex-col gap-4 rounded-xl bg-panel p-4">
        <label className="flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-black focus-within:ring-4 focus-within:ring-accent">
          <Search className="size-5 shrink-0" aria-hidden />
          <span className="sr-only">Buscar series</span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por título: Don Gato, Hey Arnold, Dexter..."
            className="w-full bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
          />
          {(typing || (status === "loading" && query && !showFavorites)) && <Loader2 className="size-5 shrink-0 animate-spin text-black/50" aria-hidden />}
          {input && (
            <button type="button" onClick={() => setInput("")} aria-label="Borrar búsqueda" className="rounded p-0.5 hover:bg-black/10">
              <X className="size-5" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar">
          <Chip active={filter === ""} onClick={() => setFilter("")}>
            Todas
          </Chip>
          <Chip active={showFavorites} onClick={() => setFilter(FAVORITES)} bg="#ff3ea5" ink="#fff">
            <Heart className="size-3.5 fill-current" aria-hidden /> Mis favoritos{favorites.length > 0 && ` (${favorites.length})`}
          </Chip>
          {genres.map((g) => (
            <Chip key={g} active={filter === g} onClick={() => setFilter(g)} {...brandByGenre.get(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </div>

      {showFavorites ? (
        <>
          <p className="font-mono text-xl text-white/60">{favoriteResults.length} series en favoritos</p>
          {favoriteResults.length === 0 ? (
            <StateMessage
              tone="info"
              title={favorites.length === 0 ? "Todavía no guardaste ninguna serie" : "Ningún favorito coincide"}
              action={
                <button type="button" onClick={() => setFilter("")} className="chunky mt-1 rounded-lg bg-accent px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5">
                  Ver toda la biblioteca
                </button>
              }
            >
              {favorites.length === 0 ? "Tocá el corazón en cualquier serie y va a aparecer acá." : `No tenés favoritos que coincidan con “${query}”.`}
            </StateMessage>
          ) : (
            <SeriesGrid>
              {favoriteResults.map((f) => (
                <li key={f.id}>
                  <SeriesCard id={f.id} name={f.name} poster={f.poster}>
                    <FavoriteButton id={f.id} name={f.name} poster={f.poster} compact />
                  </SeriesCard>
                </li>
              ))}
            </SeriesGrid>
          )}
        </>
      ) : (
        <>
          <p className="font-mono text-xl text-white/60" aria-live="polite">
            {status === "loading"
              ? "Buscando..."
              : status === "ready" &&
                (query ? `${results.length} resultado${results.length === 1 ? "" : "s"} para “${query}”` : genre ? `Series de ${genre}` : "Todas las series")}
          </p>

          {status === "loading" && (
            <SeriesGrid>
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i}>
                  <SeriesCardSkeleton />
                </li>
              ))}
            </SeriesGrid>
          )}

          {status === "error" && (
            <StateMessage
              tone="error"
              title="No pudimos cargar la biblioteca"
              action={
                <button type="button" onClick={() => void load(0)} className="chunky mt-1 rounded-lg bg-accent px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5">
                  Reintentar
                </button>
              }
            >
              {error}
            </StateMessage>
          )}

          {status === "ready" && results.length === 0 && (
            <p className="text-center text-white/60">
              {query ? `No encontramos series para “${query}”${genre ? ` en ${genre}` : ""}. Probá con otro título o filtro.` : "No hay series para mostrar."}
            </p>
          )}

          {status === "ready" && results.length > 0 && (
            <>
              <SeriesGrid>
                {results.map((s) => (
                  <li key={s.id}>
                    <SeriesCard
                      id={s.id}
                      name={s.name}
                      poster={s.poster}
                      badges={
                        s.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {s.genres.map((g) => (
                              <GenreBadge key={g} genre={g} />
                            ))}
                          </div>
                        )
                      }
                    >
                      <FavoriteButton id={s.id} name={s.name} poster={s.poster} compact />
                    </SeriesCard>
                  </li>
                ))}
              </SeriesGrid>
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void load(results.length)}
                    disabled={loadingMore}
                    className="chunky inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 className="size-4 animate-spin" />}
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function GenreBadge({ genre }: { genre: string }) {
  const brand = brandByGenre.get(genre);
  return (
    <span
      className="rounded border-2 border-black px-1.5 font-mono text-sm leading-tight"
      style={{ backgroundColor: brand?.bg ?? "#ffffff", color: brand?.ink ?? "#000000" }}
    >
      {genre}
    </span>
  );
}

function Chip({ active, onClick, children, bg, ink }: { active: boolean; onClick: () => void; children: React.ReactNode; bg?: string; ink?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border-2 border-black px-3 py-1 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${active ? "ring-4 ring-accent" : "opacity-75 hover:opacity-100"}`}
      style={{ backgroundColor: bg ?? (active ? "#ffd400" : "#fff"), color: ink ?? "#000" }}
    >
      {children}
    </button>
  );
}
