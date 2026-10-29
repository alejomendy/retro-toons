"use client";

/**
 * Pide de antemano las fuentes de un episodio para que el servidor las tenga en caché
 * (15 min) cuando el usuario llegue: el addon tarda entre 5 y 30 s en buscarlas.
 * No hace nada con la respuesta y nunca lo hace dos veces por episodio en la misma pestaña.
 */
const requested = new Set<string>();

export function prefetchStreams(episodeId: string): void {
  if (requested.has(episodeId)) return;
  requested.add(episodeId);
  fetch(`/api/series/${encodeURIComponent(episodeId)}/streams`, { priority: "low" } as RequestInit).catch(() => {
    requested.delete(episodeId);
  });
}
