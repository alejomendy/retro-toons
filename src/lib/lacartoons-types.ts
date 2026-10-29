import type { VideoSource } from "./types";

/**
 * Tipos de la integración con el addon de Stremio LACartoons.
 * Este archivo no importa nada del servidor: lo usan tanto las API Routes
 * como los componentes del cliente.
 */

/** Serie tal como aparece en el catálogo / búsqueda. */
export interface LcSeriesSummary {
  id: string;
  name: string;
  poster: string | null;
  genres: string[];
}

export interface LcEpisode {
  /** ID real del episodio, ej. "lacart_123:1:1". */
  id: string;
  title: string;
  season: number;
  episode: number;
  thumbnail: string | null;
  released: string | null;
  overview: string | null;
}

export interface LcSeries extends LcSeriesSummary {
  background: string | null;
  description: string | null;
  releaseInfo: string | null;
  language: string | null;
  /** En el mismo orden en que los devuelve el addon. */
  videos: LcEpisode[];
}

export type LcStreamKind = "hls" | "dash" | "mp4" | "webm" | "unknown";

export interface LcStream {
  url: string;
  /** Nombre para mostrar en el selector (ej. "LACartoons · 720p"). */
  label: string;
  kind: LcStreamKind;
  /** MIME para Video.js. */
  mimeType: string;
  /** El addon avisa que la fuente no está pensada para navegadores. */
  notWebReady: boolean;
  /**
   * El addon pide encabezados HTTP (Referer, User-Agent...) que el navegador
   * no puede mandar desde un <video>. Puede reproducirse igual, o no.
   */
  requiresHeaders: boolean;
}

export type LcErrorCode =
  | "ADDON_UNREACHABLE"
  | "ADDON_BAD_RESPONSE"
  | "INVALID_ID"
  | "SERIES_NOT_FOUND"
  | "NO_EPISODES"
  | "NO_STREAMS"
  | "MALFORMED_DATA";

/** Respuesta de error común de las API Routes de series. */
export interface LcApiError {
  success: false;
  error: string;
  code: LcErrorCode;
}

/** Mensajes para mostrar al usuario según el código de error. */
export const lcErrorMessages: Record<LcErrorCode, string> = {
  ADDON_UNREACHABLE: "No se pudo conectar con el catálogo de LACartoons. ¿Está corriendo el addon?",
  ADDON_BAD_RESPONSE: "El catálogo respondió con un error. Probá de nuevo en un rato.",
  INVALID_ID: "El identificador no es válido.",
  SERIES_NOT_FOUND: "Esa serie no existe en el catálogo.",
  NO_EPISODES: "Esta serie todavía no tiene episodios disponibles.",
  NO_STREAMS: "No hay fuentes de video disponibles para este episodio.",
  MALFORMED_DATA: "El catálogo devolvió datos incompletos o con un formato inesperado.",
};

/** Un espacio de la programación del día armado con series de LACartoons. */
export interface LcSlot {
  /** Minutos desde las 00:00. */
  start: number;
  end: number;
  block: string;
  series: Pick<LcSeriesSummary, "id" | "name" | "poster">;
  episode: Pick<LcEpisode, "id" | "title" | "season" | "episode">;
  /**
   * Episodios siguientes de la misma serie: la tele los usa si el del espacio no carga
   * o si termina con tiempo de sobra antes del próximo programa (como los cortos).
   */
  more?: Pick<LcEpisode, "id" | "title" | "season" | "episode">[];
  /**
   * Episodio de otra fuente legal (canal oficial de YouTube, Pluto TV...) para series
   * icónicas que LACartoons no tiene. Sin esto, el espacio es de LACartoons.
   */
  external?: {
    source?: VideoSource;
    /** Duración del episodio (min), para saber cuándo pasar la tanda. */
    minutes: number;
    /** Dónde verlo completo fuera de la página. */
    url?: string;
    /** Nombre de la fuente para mostrar ("YouTube", "Pluto TV"...). */
    via: string;
  };
}

/** Agrupa episodios por temporada sin alterar el orden original. */
export function groupBySeason(videos: LcEpisode[]): { season: number; episodes: LcEpisode[] }[] {
  const groups = new Map<number, LcEpisode[]>();
  for (const v of videos) {
    const list = groups.get(v.season);
    if (list) list.push(v);
    else groups.set(v.season, [v]);
  }
  return [...groups].map(([season, episodes]) => ({ season, episodes }));
}

/** "T1 · E3" */
export function episodeLabel(e: Pick<LcEpisode, "season" | "episode">): string {
  return `T${e.season} · E${e.episode}`;
}

/** ID de serie a partir del ID de episodio ("lacart_123:1:1" → "lacart_123"). */
export function seriesIdOf(episodeId: string): string {
  return episodeId.split(":")[0];
}

export function isValidSeriesId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(id);
}

export function isValidEpisodeId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_.-]{1,80}(?::[A-Za-z0-9_.-]{1,20}){0,3}$/.test(id);
}

/** Rutas de la app. */
export const seriesHref = (id: string) => `/biblioteca/${encodeURIComponent(id)}`;
export const watchHref = (seriesId: string, episodeId: string, startAt?: number) =>
  `${seriesHref(seriesId)}/ver?ep=${encodeURIComponent(episodeId)}${startAt ? `&t=${Math.floor(startAt)}` : ""}`;
