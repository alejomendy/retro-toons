import "server-only";
import { unstable_cache } from "next/cache";

/**
 * GET de JSON con caché, que solo guarda respuestas válidas.
 * Las wikis (Wikipedia, Fandom) a veces responden 200 con un texto de
 * "demasiados pedidos" en vez de JSON; con el fetch cacheado de Next eso
 * quedaría guardado días. Acá un error no se cachea y se reintenta después.
 */
export async function fetchJsonCached<T>(url: string, ttlSeconds: number, headers?: HeadersInit): Promise<T | null> {
  const load = unstable_cache(
    async () => {
      const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${res.status} en ${url}`);
      return (await res.json()) as T; // si no es JSON, tira error y no se guarda
    },
    ["json", url],
    { revalidate: ttlSeconds },
  );
  try {
    return await load();
  } catch {
    return null;
  }
}
