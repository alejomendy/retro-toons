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

const CACHE_SECONDS = 12 * 60 * 60;
/** Lo que se espera a la lista de series locales antes de responder sin ellas (se sigue armando por detrás). */
const EXTERNAL_WAIT_MS = 3000;

/** Series de LACartoons con video, más los nombres de las series locales que están en LACartoons. */
const lacartoonsIndex = unstable_cache(
  async (): Promise<IndexEntry[]> => {
    const entries: IndexEntry[] = (await getFullCatalog())
      .filter((series) => isPlayable(series))
      .map((series) => ({ key: normalize(series.name), href: `/biblioteca/${series.id}`, title: series.name }));
    for (const show of shows) {
      const names = localNames(show);
      const lcKey = normalize(show.lacartoons ?? show.title);
      const inLc = entries.find((e) => sameName(e.key, lcKey) || names.some((k) => sameName(e.key, k)));
      if (inLc) entries.push(...names.map((key) => ({ key, href: inLc.href, title: inLc.title })));
    }
    return entries;
  },
  ["retrotoons-watch-index-v2"],
  { revalidate: CACHE_SECONDS },
);

/**
 * Series locales que se ven desde YouTube oficial o Pluto TV. Armar la lista consulta esas fuentes
 * serie por serie (puede tardar minutos en frío), por eso va en su propia caché.
 */
const externalIds = unstable_cache(async (): Promise<string[]> => (await getExternalSeries()).map((s) => s.id), ["retrotoons-external-ids-v1"], {
  revalidate: CACHE_SECONDS,
});

function localNames(show: (typeof shows)[number]): string[] {
  return [show.title, show.originalTitle].map(normalize).filter((k) => k.length >= 3);
}

/** Una misma respuesta consulta cientos de títulos: el índice se arma una vez y se reusa un rato. */
let memo: { at: number; full: boolean; promise: Promise<IndexEntry[]> } | null = null;
const MEMO_MS = 60_000;

function buildIndex(): Promise<IndexEntry[]> {
  // Un índice armado sin las series locales (en frío) se rehace en cuanto estén listas.
  if (memo && Date.now() - memo.at < (memo.full ? MEMO_MS : EXTERNAL_WAIT_MS)) return memo.promise;
  const current = { at: Date.now(), full: false, promise: Promise.resolve<IndexEntry[]>([]) };
  current.promise = assembleIndex(() => (current.full = true));
  memo = current;
  return current.promise;
}

async function assembleIndex(onFull: () => void): Promise<IndexEntry[]> {
  let ready = false;
  const pending = externalIds()
    .then((ids) => ((ready = true), ids))
    .catch((): string[] => []);
  const index = await assembleWith(pending);
  if (ready) onFull();
  return index;
}

async function assembleWith(pending: Promise<string[]>): Promise<IndexEntry[]> {
  const [lc, external] = await Promise.all([
    lacartoonsIndex().catch((): IndexEntry[] => []),
    // En frío no se espera a las series locales: esta respuesta sale sin ellas y la próxima ya las tiene.
    Promise.race([pending, new Promise<string[]>((resolve) => setTimeout(() => resolve([]), EXTERNAL_WAIT_MS))]),
  ]);
  const ids = new Set(external);
  // Las series locales con fuente propia van primero: ganan sobre una versión sin video de LACartoons.
  const local = shows.filter((s) => ids.has(s.id)).flatMap((s) => localNames(s).map((key) => ({ key, href: `/biblioteca/${s.id}`, title: s.title })));
  return [...local, ...lc];
}

/** Busca un título por cualquiera de sus nombres; primero coincidencia exacta, después aproximada. */
export async function findWatchable(names: (string | null | undefined)[]): Promise<Watchable | null> {
  const keys = [...new Set(names.filter((n): n is string => !!n).map(normalize).filter((k) => k.length >= 3))];
  if (keys.length === 0) return null;
  const index = await buildIndex();
  const hit = index.find((e) => keys.includes(e.key)) ?? index.find((e) => keys.some((k) => sameName(e.key, k)));
  return hit ? { href: hit.href, title: hit.title } : null;
}
