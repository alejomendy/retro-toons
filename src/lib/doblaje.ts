import "server-only";
import { fetchJsonCached } from "@/lib/http";
import { normalize } from "@/lib/text";

/**
 * Doblaje Wiki (https://doblaje.fandom.com/es) — wiki del doblaje latinoamericano, sin API key.
 * Las páginas de cada serie (y sus subpáginas por temporada, ej. "Bob Esponja/1.ª temporada")
 * nombran los episodios como  '''Título latino''' (''Título original'').
 * Contenido bajo CC BY-SA: mostramos el enlace.
 */
const API = "https://doblaje.fandom.com/es/api.php";
const ONE_WEEK = 60 * 60 * 24 * 7;
const HEADERS = { "User-Agent": "RetroToons/1.0 (sitio de fans de dibujos animados)" };
/** Máximo de subpáginas a leer por serie. */
const MAX_PAGES = 25;

function api<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: "json", formatversion: "2" });
  return fetchJsonCached<T>(`${API}?${qs}`, ONE_WEEK, HEADERS);
}

/** Página de la serie: primero por título exacto, después por búsqueda. */
async function findSeriesPage(names: string[]): Promise<string | null> {
  type Q = { query?: { pages: { title: string; missing?: boolean }[] } };
  const exact = await api<Q>({ action: "query", titles: [...new Set(names)].join("|"), redirects: "1" });
  const hit = exact?.query?.pages.find((p) => !p.missing);
  if (hit) return hit.title;

  type S = { query?: { search: { title: string }[] } };
  const wanted = names.map(normalize);
  for (const name of names) {
    const found = await api<S>({ action: "query", list: "search", srsearch: name, srlimit: "5" });
    const match = found?.query?.search.find((r) => wanted.includes(normalize(r.title.replace(/\s*\(.*\)$/, ""))));
    if (match) return match.title;
  }
  return null;
}

async function subpages(page: string): Promise<string[]> {
  type A = { query?: { allpages: { title: string }[] } };
  const res = await api<A>({ action: "query", list: "allpages", apprefix: `${page}/`, aplimit: String(MAX_PAGES) });
  return res?.query?.allpages.map((p) => p.title) ?? [];
}

async function wikitext(page: string): Promise<string> {
  const res = await api<{ parse?: { wikitext: string } }>({ action: "parse", page, prop: "wikitext" });
  return res?.parse?.wikitext ?? "";
}

function clean(text: string): string {
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface DoblajeTitles {
  /** Título original normalizado → título latino. */
  titles: Map<string, string>;
  url: string | null;
}

/** Títulos latinos de los episodios de una serie, indexados por su título original. */
export async function getDoblajeTitles(names: string[]): Promise<DoblajeTitles> {
  const titles = new Map<string, string>();
  const page = await findSeriesPage(names);
  if (!page) return { titles, url: null };

  const pages = [page, ...(await subpages(page))].slice(0, MAX_PAGES);
  const texts = await Promise.all(pages.map(wikitext));
  const pair = /'''([^'\n]{1,120}?)'''\s*\(\s*''([^'\n]{1,120}?)''\s*\)/g;
  for (const text of texts) {
    for (const m of text.matchAll(pair)) {
      const es = clean(m[1]);
      const en = clean(m[2]);
      if (es && en && normalize(es) !== normalize(en) && !titles.has(normalize(en))) titles.set(normalize(en), es);
    }
  }
  return { titles, url: `https://doblaje.fandom.com/es/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}` };
}
