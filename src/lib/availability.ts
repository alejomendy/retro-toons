import "server-only";
import { unstable_cache } from "next/cache";
import { shows } from "@/data/shows";
import { getExternalSeries, getFullCatalog, isPlayable, normalize } from "./lacartoons-schedule";

/**
 * ¿Se puede ver en RetroToons? Cruza títulos de catálogos externos (TMDB, addons de Stremio)
 * con lo que la página reproduce en español latino: series de LACartoons con video
 * (data/playable.json) y series locales con episodios en YouTube oficial o Pluto TV.
 */
export interface Watchable {
  /** Página de la serie en RetroToons. */
  href: string;
  /** Nombre con el que figura en RetroToons. */
  title: string;
}

interface IndexEntry extends Watchable {
  key: string;
}

const compact = (key: string) => key.replace(/ /g, "");

/** Distancia de edición (para tolerar "Phineas y Pherb" ↔ "Phineas y Ferb"). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

function sameName(a: string, b: string): boolean {
  if (a === b || compact(a) === compact(b)) return true;
  // Solo nombres largos: en los cortos una letra cambia la serie ("Ben 10" ≠ "Ben 100").
  if (Math.min(a.length, b.length) < 8) return false;
  // La primera palabra tiene que ser la misma: "Spidey y sus amigos" ≠ "Spiderman y sus amigos".
  if (a.split(" ")[0] !== b.split(" ")[0]) return false;
  return 1 - distance(a, b) / Math.max(a.length, b.length) >= 0.86;
}

const buildIndex = unstable_cache(
  async (): Promise<IndexEntry[]> => {
    const catalog = await getFullCatalog();
    const entries: IndexEntry[] = catalog
      .filter((series) => isPlayable(series))
      .map((series) => ({ key: normalize(series.name), href: `/biblioteca/${series.id}`, title: series.name }));

    // Series locales: sus nombres (latino y original) llevan a la misma serie de LACartoons si está,
    // o a su página propia si se ven desde YouTube oficial o Pluto TV.
    const external = new Set((await getExternalSeries().catch(() => [])).map((s) => s.id));
    for (const show of shows) {
      const names = [show.title, show.originalTitle].map(normalize).filter((k) => k.length >= 3);
      const lcKey = normalize(show.lacartoons ?? show.title);
      const inLc = entries.find((e) => sameName(e.key, lcKey) || names.some((k) => sameName(e.key, k)));
      const target = external.has(show.id) ? { href: `/biblioteca/${show.id}`, title: show.title } : inLc;
      if (!target) continue;
      for (const key of names) entries.push({ key, href: target.href, title: target.title });
    }
    return entries;
  },
  ["retrotoons-watch-index-v1"],
  { revalidate: 12 * 60 * 60 },
);

/** Busca un título por cualquiera de sus nombres; primero coincidencia exacta, después aproximada. */
export async function findWatchable(names: (string | null | undefined)[]): Promise<Watchable | null> {
  const keys = [...new Set(names.filter((n): n is string => !!n).map(normalize).filter((k) => k.length >= 3))];
  if (keys.length === 0) return null;
  const index = await buildIndex().catch((): IndexEntry[] => []);
  const hit = index.find((e) => keys.includes(e.key)) ?? index.find((e) => keys.some((k) => sameName(e.key, k)));
  return hit ? { href: hit.href, title: hit.title } : null;
}
