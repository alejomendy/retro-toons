export type ChannelId = "cartoon-network" | "nickelodeon" | "disney-xd" | "jetix" | "fox-kids";

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
  /** Bloques del día, en orden. Cubren las 24 hs empezando a las 00:00. */
  blocks: ScheduleBlock[];
}

export interface ScheduleBlock {
  name: string;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" — "24:00" para fin del día. */
  end: string;
  /** Series que rotan dentro del bloque. */
  shows: string[];
  /** Duración de cada espacio en minutos (por defecto 30). */
  slotMinutes?: number;
}

export interface Show {
  id: string;
  title: string;
  /** Título original en inglés (para buscar en TVmaze/YouTube). */
  originalTitle: string;
  /** ID de la serie en https://www.tvmaze.com */
  tvmazeId?: number;
  /** ID en TMDB. Si falta se busca por título original + año. */
  tmdbId?: number;
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
  | { type: "file"; url: string };

export interface Episode {
  showId: string;
  /** 1-based */
  number: number;
  title: string;
  minutes: number;
  source?: VideoSource;
  /** Datos de TVmaze cuando están disponibles. */
  season?: number;
  numberInSeason?: number;
  airdate?: string;
  summary?: string;
  image?: string;
}

/** Info extra de la serie traída de las APIs (TMDB → Wikipedia → TVmaze). */
export interface ShowExtras {
  /** Título en español latino según TMDB. */
  localTitle: string | null;
  summary: string | null;
  /** De dónde salió la sinopsis, para la atribución. */
  summarySource: "tmdb" | "wikipedia" | "tvmaze" | null;
  image: string | null;
  backdrop: string | null;
  network: string | null;
  /** Openings/trailers en YouTube (claves de video). */
  videos: { key: string; name: string; type: string }[];
  /** Plataformas donde verla legalmente en la región configurada. */
  providers: { name: string; logo: string }[];
  providersLink: string | null;
  wikipediaUrl: string | null;
  tmdbId: number | null;
}

export interface Slot {
  start: number; // minutos desde las 00:00
  end: number;
  block: string;
  show: Show;
  episode: Episode;
}
