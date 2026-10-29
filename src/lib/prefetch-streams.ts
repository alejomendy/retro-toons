"use client";

/**
 * Fuentes de video de un episodio, compartidas en la pestaña: si se pidieron de antemano
 * (al pasar el mouse, el próximo episodio, los canales vecinos), el reproductor usa esa misma
 * respuesta en vez de volver a esperar al addon, que tarda entre 5 y 30 s en buscarlas.
 *
 * El addon busca las fuentes de a una por vez (Chromium en 512 MB). Por eso los pedidos de antemano
 * van en fila, de a uno, y solo se guardan los últimos: pasar el mouse por una lista de 20 episodios
 * no puede dejar al que elegiste esperando detrás de los otros 19.
 */
export interface StreamsResponse {
  status: number;
  data: unknown;
}

/** Las respuestas buenas se reusan un rato; los errores se vuelven a pedir. */
const KEEP_MS = 10 * 60 * 1000;
/** Pedidos de antemano que esperan turno (los más viejos se descartan). */
const MAX_QUEUED = 2;

const cache = new Map<string, { at: number; promise: Promise<StreamsResponse> }>();
let queue: string[] = [];
let prefetching = false;
/** Pedidos que alguien está esperando de verdad (el reproductor): mientras haya, no se adelanta nada. */
let watching = 0;

function cached(episodeId: string): Promise<StreamsResponse> | undefined {
  const hit = cache.get(episodeId);
  return hit && Date.now() - hit.at < KEEP_MS ? hit.promise : undefined;
}

function request(episodeId: string, priority: "high" | "low"): Promise<StreamsResponse> {
  const promise = fetch(`/api/series/${encodeURIComponent(episodeId)}/streams`, { cache: "no-store", priority } as RequestInit).then(
    async (r) => ({ status: r.status, data: await r.json().catch(() => null) }),
  );
  cache.set(episodeId, { at: Date.now(), promise });
  promise.then(
    (res) => {
      // Errores y listas vacías no se guardan: la próxima vez se vuelve a probar.
      const empty = Array.isArray((res.data as { streams?: unknown[] } | null)?.streams) && (res.data as { streams: unknown[] }).streams.length === 0;
      if (res.status !== 200 || empty) cache.delete(episodeId);
    },
    () => cache.delete(episodeId),
  );
  return promise;
}

/** Las fuentes de un episodio que se va a reproducir ahora: pasa adelante de los pedidos de antemano. */
export function getStreams(episodeId: string): Promise<StreamsResponse> {
  queue = [];
  watching++;
  const promise = cached(episodeId) ?? request(episodeId, "high");
  const done = () => {
    watching--;
    pump();
  };
  promise.then(done, done);
  return promise;
}

function pump(): void {
  if (prefetching || watching > 0) return;
  const next = queue.pop();
  if (!next) return;
  if (cached(next)) return pump();
  prefetching = true;
  const done = () => {
    prefetching = false;
    pump();
  };
  request(next, "low").then(done, done);
}

/** Pide las fuentes en segundo plano, sin esperar la respuesta (en fila, de a una). */
export function prefetchStreams(episodeId: string): void {
  if (cached(episodeId)) return;
  queue = [...queue.filter((id) => id !== episodeId), episodeId].slice(-MAX_QUEUED);
  pump();
}

/** Olvida la respuesta guardada (ej. para reintentar después de un error). */
export function forgetStreams(episodeId: string): void {
  cache.delete(episodeId);
}
