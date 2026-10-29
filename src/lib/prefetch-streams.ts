"use client";

/**
 * Fuentes de video de un episodio, compartidas en la pestaña: si se pidieron de antemano
 * (al pasar el mouse, el próximo episodio, los canales vecinos), el reproductor usa esa misma
 * respuesta en vez de volver a esperar al addon, que tarda entre 5 y 30 s en buscarlas.
 */
export interface StreamsResponse {
  status: number;
  data: unknown;
}

/** Las respuestas buenas se reusan un rato; los errores se vuelven a pedir. */
const KEEP_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<StreamsResponse> }>();

export function getStreams(episodeId: string, priority: "high" | "low" = "high"): Promise<StreamsResponse> {
  const hit = cache.get(episodeId);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.promise;

  const promise = fetch(`/api/series/${encodeURIComponent(episodeId)}/streams`, { cache: "no-store", priority } as RequestInit).then(
    async (r) => ({ status: r.status, data: await r.json().catch(() => null) }),
  );
  cache.set(episodeId, { at: Date.now(), promise });
  promise.then(
    (res) => {
      if (res.status !== 200) cache.delete(episodeId);
    },
    () => cache.delete(episodeId),
  );
  return promise;
}

/** Pide las fuentes en segundo plano, sin esperar la respuesta. */
export function prefetchStreams(episodeId: string): void {
  getStreams(episodeId, "low").catch(() => {});
}

/** Olvida la respuesta guardada (ej. para reintentar después de un error). */
export function forgetStreams(episodeId: string): void {
  cache.delete(episodeId);
}
