/**
 * Servidores de imágenes que acepta next/image. Lo usan next.config.ts y el cliente de los addons:
 * un póster de otro servidor haría fallar la página entera, así que el cliente lo descarta.
 */
export const IMAGE_HOSTS = [
  "image.tmdb.org", // TMDB
  "upload.wikimedia.org", // Wikipedia
  "thumb.wikimedia.org",
  "lacartoons.com", // Pósters y fondos de LACartoons
  "springfield-3000.ak-forge.workers.dev", // Addon Springfield 3000
  "scplus.duckdns.org", // Addon SCPlus
  "api.ratingposterdb.com", // Pósters con puntaje que usa SCPlus
  "images.metahub.space", // Arte de Stremio (Cinemeta)
  "episodes.metahub.space",
];

export function isAllowedImage(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && IMAGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}
