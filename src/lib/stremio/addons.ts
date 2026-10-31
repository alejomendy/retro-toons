/** Addons Stremio habilitados en RetroToons.
 * La disponibilidad real se valida al consultar cada episodio: declarar
 * `stream` en el manifiesto no garantiza que cada título tenga una fuente.
 */
export const STREMIO_ADDONS = {
  animVault: {
    id: "animvault",
    name: "AnimVault",
    baseUrl: "https://animvault.onrender.com",
    description: "Películas animadas, dibujos clásicos y series. Fuente experimental: comprobar cada episodio.",
    language: "Multilingüe",
    focus: "Animación",
    visible: true,
  },
  torrentio: {
    id: "torrentio",
    name: "Torrentio",
    baseUrl: "https://torrentio.strem.fun",
    description: "Buscador de fuentes Stremio por título/episodio. Requiere identificador IMDb; los resultados P2P no son reproducibles directamente en HTML5.",
    language: "Depende de cada fuente",
    focus: "Fuentes por episodio",
    visible: true,
  },
  cinemeta: {
    id: "cinemeta",
    name: "Cinemeta",
    baseUrl: "https://v3-cinemeta.strem.io",
    description: "Proveedor auxiliar de metadatos y búsqueda; no es una fuente de video.",
    language: "Metadatos",
    focus: "Búsqueda",
    visible: false,
  },
} as const;

export type StremioAddonKey = keyof typeof STREMIO_ADDONS;
export type StremioAddonId = (typeof STREMIO_ADDONS)[StremioAddonKey]["id"];

export function getStremioAddon(key: string) {
  return Object.values(STREMIO_ADDONS).find((addon) => addon.id === key);
}
