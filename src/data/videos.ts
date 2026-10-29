import type { VideoSource } from "@/lib/types";

/**
 * Fuentes de video de cada episodio.
 *
 * Clave: "<showId>:<número de episodio>"  →  ej. "dexter:1"
 *
 * Tipos soportados:
 *   { type: "youtube", id: "dQw4w9WgXcQ" }       → embed de YouTube
 *   { type: "file", url: "/videos/dexter-01.mp4" } → archivo propio (public/ o un CDN)
 *
 * Los episodios sin fuente se muestran con la pantalla de "sin señal".
 * Cargá solo contenido sobre el que tengas derechos o que esté publicado
 * oficialmente para embeber.
 */
export const videoSources: Record<string, VideoSource> = {
  // "dexter:1": { type: "youtube", id: "XXXXXXXXXXX" },
};
