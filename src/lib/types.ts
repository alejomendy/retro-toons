export type ChannelId = "cartoon-network" | "nickelodeon" | "jetix" | "disney" | "warner" | "fox";

export interface Channel {
  id: ChannelId;
  name: string;
  tagline: string;
  /** Color principal de la marca (fondo de la pestaña, bordes). */
  color: string;
  /** Color del texto sobre `color`. */
  ink: string;
  years: string;
  description: string;
  /** Cadenas ("genre") del catálogo de LACartoons de las que salen las series del canal. */
  lacartoons: string[];
  /** Bloques del día, en orden. Cubren las 24 hs empezando a las 00:00. */
  blocks: ScheduleBlock[];
}

export interface ScheduleBlock {
  name: string;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" — "24:00" para fin del día. */
  end: string;
  /** Series locales (data/shows.ts) del bloque: se ven desde otras fuentes legales si LACartoons no las tiene. */
  shows?: string[];
  /** Series del bloque, por su nombre en el catálogo de LACartoons. */
  lacartoons?: string[];
  /** Días en que va el bloque (0 = domingo … 6 = sábado). Sin esto, todos los días. */
  days?: number[];
  /** Maratón: el bloque pasa solo sus series aunque sean pocas (no se completa con otras del canal). */
  exclusive?: boolean;
  /** Duración de cada espacio en minutos (por defecto 30). */
  slotMinutes?: number;
}

export interface Show {
  id: string;
  title: string;
  /** Título original en inglés (para buscar en TMDB/YouTube; no se muestra como título principal). */
  originalTitle: string;
  /** Nombre en el catálogo de LACartoons cuando no coincide con `title` ni `originalTitle`. */
  lacartoons?: string;
  /** ID en TMDB. Si falta se busca por título original + año. */
  tmdbId?: number;
  /** Wiki de fans con títulos latinos de episodios (ver lib/fanwiki.ts). */
  fanWiki?: FanWiki;
  /** Canales OFICIALES de YouTube que suben episodios completos (ver lib/youtube-channels.ts). */
  youtubeChannels?: string[];
  /** false si el canal numera los episodios distinto que TMDB: solo se cruza por nombre. */
  matchByNumber?: boolean;
  /** false si lo que hay en Pluto TV con ese nombre es otra versión (ej. Tortugas Ninja 2012 ≠ 2003). */
  pluto?: boolean;
  channels: ChannelId[];
  /** Año de estreno. */
  year: number;
  genre: string;
  description: string;
  seasons: number;
  /** Cantidad de episodios disponibles en la biblioteca. */
  episodeCount: number;
  /** Duración aproximada de un episodio (min). */
  episodeMinutes: number;
  /** Dos colores para la portada generada. */
  palette: [string, string];
  /** Títulos opcionales por episodio (índice 0 = episodio 1). */
  episodeTitles?: string[];
}

export type VideoSource =
  | { type: "youtube"; id: string }
  | { type: "dailymotion"; id: string }
  /** Stream HLS (ej. Pluto TV vía /api/hls); pageUrl es la página original para la atribución. */
  | { type: "hls"; url: string; pageUrl?: string }
  | { type: "file"; url: string };

export interface Episode {
  showId: string;
  /** 1-based */
  number: number;
  title: string;
  minutes: number;
  source?: VideoSource;
  /** Datos de TMDB cuando están disponibles. */
  season?: number;
  numberInSeason?: number;
  airdate?: string;
  summary?: string;
  image?: string;
}

/** Info extra de la serie traída de las APIs (TMDB → Wikipedia), siempre en español. */
export interface ShowExtras {
  /** Título en español latino según TMDB. */
  localTitle: string | null;
  summary: string | null;
  /** De dónde salió la sinopsis, para la atribución. */
  summarySource: "tmdb" | "wikipedia" | null;
  image: string | null;
  backdrop: string | null;
  /** Openings/trailers en YouTube (claves de video). */
  videos: { key: string; name: string; type: string }[];
  /** Plataformas donde verla legalmente en la región configurada. */
  /** `free`: gratis con publicidad, sin suscripción. */
  providers: { name: string; logo: string; free: boolean }[];
  providersLink: string | null;
  /** Gratis y legal (sin embeber), ej. Pluto TV. */
  free: FreeOption[];
  wikipediaUrl: string | null;
  /** Wikis de las que salieron títulos de episodios (para la atribución). */
  credits: { name: string; url: string }[];
  tmdbId: number | null;
}

/** Dónde ver la serie gratis y legal (sin embeber), ej. un canal de Pluto TV. */
export interface FreeOption {
  platform: string;
  /** "canal" en vivo o "serie" a demanda. */
  kind: "canal" | "serie";
  name: string;
  url: string;
  /** Lo que está pasando ahora en el canal. */
  now: { title: string; until: string } | null;
  /** Stream HLS del canal en vivo para verlo en la página (vía /api/hls). */
  stream?: string;
}

/** Wiki de fans en Fandom (español) con una lista de episodios. */
export interface FanWiki {
  /** Subdominio de Fandom, ej. "tortugasninja" → tortugasninja.fandom.com/es */
  wiki: string;
  /** Página con la lista de episodios. */
  page: string;
}
