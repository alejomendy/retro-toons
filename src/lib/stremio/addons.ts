/**
 * Addons de Stremio. `tab`: cómo aparece en /addons — "catalog" (se recorren sus catálogos),
 * "torrentio" (buscador de fuentes) o null (auxiliar, sin pestaña).
 */
export const STREMIO_ADDONS = {
  cartoonNetwork: {
    id: "cartoon-network",
    name: "Cartoon Network",
    baseUrl: "https://e1fc7808b5de-stremio-cartoon-network.baby-beamup.club",
    tab: "catalog",
  },
  springfield: {
    id: "springfield-3000",
    name: "Springfield 3000",
    baseUrl: "https://springfield-3000.ak-forge.workers.dev",
    tab: "catalog",
  },
  scplus: {
    id: "scplus",
    name: "SCPlus",
    baseUrl: "https://scplus.duckdns.org/c.012e984ad8a7752b37f74559b5917fe798378a70",
    tab: "catalog",
  },
  // Catálogos de animación curados de TMDB (ids de IMDb, en inglés: se pasan al español con TMDB).
  animVault: {
    id: "animvault",
    name: "AnimVault",
    baseUrl: "https://animvault.onrender.com",
    tab: "catalog",
  },
  torrentio: {
    id: "torrentio",
    name: "Torrentio",
    baseUrl: "https://torrentio.strem.fun",
    tab: "torrentio",
  },
  // Metadatos y búsqueda para Torrentio (no es una fuente de video).
  cinemeta: {
    id: "cinemeta",
    name: "Cinemeta",
    baseUrl: "https://v3-cinemeta.strem.io",
    tab: null,
  },
} as const;

export type StremioAddonKey = keyof typeof STREMIO_ADDONS;
export type StremioAddon = (typeof STREMIO_ADDONS)[StremioAddonKey];
export type StremioAddonId = StremioAddon["id"];

export function getStremioAddon(key: string): StremioAddon | undefined {
  return Object.values(STREMIO_ADDONS).find((addon) => addon.id === key);
}

/** Catálogo de un addon que alimenta una colección (cada página trae 20 títulos). */
export interface CollectionSource {
  addon: StremioAddonId;
  type: "movie" | "series";
  catalog: string;
  pages: number;
}

/** Categoría nueva de la biblioteca armada con lo que ofrecen los addons. */
export interface AddonCollection {
  slug: string;
  title: string;
  description: string;
  sources: CollectionSource[];
}

// Los catálogos de SCPlus llevan al final el hash de la configuración de su URL.
const SC = "_cv24_145c0cf22d";

/**
 * Lo que traen los addons y no encaja en las cadenas de LACartoons. SCPlus organiza todo el
 * streaming actual por plataforma (sin contenido infantil); de ahí se toman solo sus catálogos de
 * animación por década. El resto se puede recorrer completo en /addons.
 */
export const ADDON_COLLECTIONS: AddonCollection[] = [
  {
    slug: "sagas-de-springfield",
    title: "Sagas de Springfield",
    description: "Recorridos temáticos por Los Simpson y Futurama: cada saga junta sus episodios en orden y se ve con los de LACartoons.",
    sources: [{ addon: "springfield-3000", type: "series", catalog: "springfield3000-sagas", pages: 1 }],
  },
  {
    slug: "peliculas-animadas",
    title: "Películas animadas",
    description: "Las películas de Cartoon Network, Los Simpson y Futurama.",
    sources: [
      { addon: "springfield-3000", type: "movie", catalog: "springfield3000-movies", pages: 1 },
      { addon: "cartoon-network", type: "movie", catalog: "cartoon_network_movie", pages: 6 },
    ],
  },
  {
    slug: "cartoon-network",
    title: "Cartoon Network: el catálogo completo",
    description: "Todas las series del canal, de los Cartoon Cartoons a las de hoy.",
    sources: [{ addon: "cartoon-network", type: "series", catalog: "cartoon_network_series", pages: 5 }],
  },
  {
    slug: "animacion-80s",
    title: "Animación de los 80",
    description: "Series y películas animadas estrenadas en los años 80.",
    sources: [
      { addon: "scplus", type: "series", catalog: `anime_series_1980s_anime${SC}`, pages: 3 },
      { addon: "scplus", type: "movie", catalog: `anime_movie_1980s_anime${SC}`, pages: 2 },
    ],
  },
  {
    slug: "animacion-90s",
    title: "Animación de los 90",
    description: "Series y películas animadas estrenadas en los años 90.",
    sources: [
      { addon: "scplus", type: "series", catalog: `anime_series_1990s_anime${SC}`, pages: 3 },
      { addon: "scplus", type: "movie", catalog: `anime_movie_1990s_anime${SC}`, pages: 2 },
    ],
  },
  {
    slug: "animacion-2000s",
    title: "Animación de los 2000",
    description: "Series y películas animadas estrenadas en los años 2000.",
    sources: [
      { addon: "scplus", type: "series", catalog: `anime_series_2000s_anime${SC}`, pages: 3 },
      { addon: "scplus", type: "movie", catalog: `anime_movie_2000s_anime${SC}`, pages: 2 },
    ],
  },
];

export function getAddonCollection(slug: string): AddonCollection | undefined {
  return ADDON_COLLECTIONS.find((c) => c.slug === slug);
}
