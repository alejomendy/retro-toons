/** Subconjunto tipado del protocolo público de addons de Stremio. */
export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  logo?: string;
  background?: string;
  resources: Array<string | { name: string; types?: string[]; idPrefixes?: string[] }>;
  types: string[];
  catalogs?: Array<{
    type: string;
    id: string;
    name?: string;
    extra?: Array<{ name: string; isRequired?: boolean; options?: string[] }>;
    extraSupported?: string[];
  }>;
  idPrefixes?: string[];
  behaviorHints?: Record<string, unknown>;
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  /** El addon de Cartoon Network no lo manda en las series: se completa con TMDB. */
  name?: string;
  poster?: string;
  background?: string;
  description?: string;
  releaseInfo?: string;
  year?: number | string | null;
  imdbRating?: string;
  /** Lista o texto separado por comas, según el addon. */
  genres?: string[] | string;
}

export interface StremioVideo {
  id: string;
  title?: string;
  name?: string;
  released?: string;
  season?: number;
  episode?: number;
  thumbnail?: string;
  overview?: string;
}

export interface StremioCatalogResponse {
  metas?: StremioMetaPreview[];
  cacheMaxAge?: number;
}

export interface StremioMetaResponse {
  meta?: StremioMetaPreview & { videos?: StremioVideo[] };
}

/** Serie o película de un addon, ya normalizada para RetroToons. */
export interface AddonTitle {
  /** Id del addon (ver STREMIO_ADDONS). */
  addon: string;
  type: "movie" | "series";
  id: string;
  name: string;
  poster: string | null;
  background: string | null;
  year: string | null;
  description: string | null;
  genres: string[];
  /** La misma serie en LACartoons, si está: entonces se puede ver en RetroToons. */
  lacartoons: { id: string; name: string } | null;
}

/** Episodio de una serie de un addon; `watch` apunta al episodio equivalente de LACartoons. */
export interface AddonEpisode {
  id: string;
  title: string;
  /** Temporada y episodio originales de la serie (no el orden dentro de la colección). */
  label: string | null;
  thumbnail: string | null;
  overview: string | null;
  watch: { seriesId: string; episodeId: string } | null;
}

/** Ruta de la ficha de un título de un addon dentro de RetroToons. */
export const addonTitleHref = (t: Pick<AddonTitle, "addon" | "type" | "id">) => `/addons/${t.addon}/${t.type}/${encodeURIComponent(t.id)}`;
