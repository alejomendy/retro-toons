import "server-only";
import { fetchJsonCached } from "@/lib/http";
import { normalize } from "@/lib/text";
import type { FanWiki } from "@/lib/types";

/**
 * Wikis de fans en español (Fandom) con listas de episodios — sin API key.
 * Cada wiki tiene su formato, así que la lectura es genérica: se recorre cada
 * fila de la tabla, se la identifica por el título original del episodio y se
 * toma el título marcado como "Latino" / "Hispanoamérica".
 * Contenido bajo CC BY-SA: mostramos el enlace.
 */
const HEADERS = { "User-Agent": "RetroToons/1.0 (sitio de fans de dibujos animados)" };
const ONE_WEEK = 60 * 60 * 24 * 7;

// "Hispanoamérica: …" / "Latino: …" (el título puede traer comillas adentro). España, solo como último recurso.
const LATINO = /(?:Hispanoam[ée]rica|Latinoam[ée]rica|Latino)\s*:\s*([^\n|<]+?)\s*(?:<|\||\n|$)/i;
const SPAIN = /Espa[ñn]a\s*:\s*([^\n|<]+?)\s*(?:<|\||\n|$)/i;

function clean(text: string): string {
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fanWikiUrl({ wiki, page }: FanWiki): string {
  return `https://${wiki}.fandom.com/es/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
}

export interface FanWikiTitles {
  /** Título original normalizado → título latino. */
  latino: Map<string, string>;
  /** Título original normalizado → título de España (último recurso). */
  spain: Map<string, string>;
}

/** Títulos de la wiki de fans para los episodios pedidos (por su título original). */
export async function getFanWikiTitles({ wiki, page }: FanWiki, originalNames: string[]): Promise<FanWikiTitles> {
  const result: FanWikiTitles = { latino: new Map(), spain: new Map() };
  const qs = new URLSearchParams({ action: "parse", page, prop: "wikitext", redirects: "1", format: "json", formatversion: "2" });
  const data = await fetchJsonCached<{ parse?: { wikitext: string } }>(`https://${wiki}.fandom.com/es/api.php?${qs}`, ONE_WEEK, HEADERS);
  const wikitext = data?.parse?.wikitext ?? "";

  const rows = wikitext.split(/\n\|-/).flatMap((row) => {
    // Sin enlaces ni negritas, pero conservando saltos de línea y etiquetas como separadores.
    const plain = row.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/'{2,}/g, "");
    const latino = plain.match(LATINO)?.[1];
    const spain = plain.match(SPAIN)?.[1];
    if (!latino && !spain) return [];
    const text = normalize(clean(row));
    return [{ text, words: new Set(text.split(" ")), latino, spain }];
  });

  for (const original of new Set(originalNames.map(normalize).filter((n) => n.length >= 3))) {
    const row = findRow(rows, original);
    if (!row) continue;
    for (const [value, map] of [[row.latino, result.latino], [row.spain, result.spain]] as const) {
      const es = value ? clean(value) : "";
      if (es && normalize(es) !== original) map.set(original, es);
    }
  }
  return result;
}

interface Row {
  text: string;
  words: Set<string>;
  latino?: string;
  spain?: string;
}

/**
 * Fila del episodio: primero la que contiene el título original completo;
 * si no hay, la que comparte al menos el 75 % de sus palabras y le gana
 * claramente a la segunda ("Turtles in Space (4): The Arena" ≈ "Turtles in Space - Part Four: The Arena").
 */
function findRow(rows: Row[], original: string): Row | null {
  const exact = rows.filter((r) => r.text.includes(original));
  if (exact.length > 0) return exact[0];

  const words = original.split(" ").filter((w) => w.length > 1);
  if (words.length < 3) return null;
  const scored = rows
    .map((r) => ({ r, score: words.filter((w) => r.words.has(w)).length / words.length }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.75) return null;
  if (second && best.score - second.score < 0.15) return null;
  return best.r;
}
