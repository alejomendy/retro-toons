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
  name: string;
  poster?: string;
  background?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
}

export interface StremioCatalogResponse {
  metas?: StremioMetaPreview[];
  cacheMaxAge?: number;
}

export interface StremioVideo {
  id: string;
  title: string;
  /** Cinemeta usa `name` en lugar de `title` para los episodios. */
  name?: string;
  released?: string;
  season?: number;
  episode?: number;
  thumbnail?: string;
  overview?: string;
}

export interface StremioMetaResponse {
  meta?: StremioMetaPreview & { videos?: StremioVideo[] };
}

export interface StremioStream {
  name?: string;
  title?: string;
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  externalUrl?: string;
  description?: string;
  sources?: string[];
  subtitles?: Array<{ id: string; url: string; lang: string }>;
  behaviorHints?: Record<string, unknown>;
}

export interface StremioStreamResponse {
  streams?: StremioStream[];
  cacheMaxAge?: number;
}
