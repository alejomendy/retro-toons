import "server-only";
import { fetchJsonCached } from "@/lib/http";
import { normalize } from "@/lib/text";

/**
 * Wikipedia en español — sin API key. Contenido bajo CC BY-SA: mostramos el enlace.
 *   - Resumen de la serie (descripción + imagen).
 *   - Títulos y sinopsis de episodios desde los anexos "Anexo:Episodios de …"
 *     (a veces divididos en varias páginas), que usan la plantilla
 *     {{Lista de episodios}} con Título (español) y AltTítulo (original en inglés).
 */
const API = "https://es.wikipedia.org/w/api.php";
const ONE_WEEK = 60 * 60 * 24 * 7;
// Wikipedia pide un User-Agent identificable, idealmente con un contacto (WIKIMEDIA_CONTACT); sin él limita más los pedidos.
const HEADERS = { "User-Agent": `RetroToons/1.0 (${process.env.WIKIMEDIA_CONTACT || "sitio de fans de dibujos animados"})` };
/** Namespace "Anexo" de la Wikipedia en español. */
const ANEXO_NS = "104";
const MAX_PAGES = 6;

function api<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: "json", formatversion: "2" });
  return fetchJsonCached<T>(`${API}?${qs}`, ONE_WEEK, HEADERS);
}

export interface WikiSummary {
  title: string;
  extract: string;
  image: string | null;
  url: string;
}

export async function getWikipediaSummary(query: string): Promise<WikiSummary | null> {
  const search = await fetchJsonCached<{ pages: { key: string }[] }>(
    `https://es.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`,
    ONE_WEEK,
    HEADERS,
  );
  const key = search?.pages[0]?.key;
  if (!key) return null;

  const page = await fetchJsonCached<{
    title: string;
    extract: string;
    thumbnail?: { source: string };
    content_urls: { desktop: { page: string } };
  }>(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`, ONE_WEEK, HEADERS);
  if (!page) return null;
  return {
    title: page.title,
    extract: page.extract,
    image: page.thumbnail?.source ?? null,
    url: page.content_urls.desktop.page,
  };
}

export interface WikiEpisode {
  title: string;
  summary: string | null;
}

/** Anexos de episodios de la serie: "Anexo:Episodios de X" y sus variantes "… (temporadas 6-10)". */
async function findEpisodeListPages(names: string[]): Promise<string[]> {
  const found = new Set<string>();
  type Q = { query?: { allpages: { title: string }[] } };
  for (const name of [...new Set(names)]) {
    const res = await api<Q>({ action: "query", list: "allpages", apnamespace: ANEXO_NS, apprefix: `Episodios de ${name}`, aplimit: "10" });
    for (const p of res?.query?.allpages ?? []) {
      // Evitar otras series que empiezan igual ("Doug" ≠ "Doug Unplugged").
      const rest = p.title.slice(`Anexo:Episodios de ${name}`.length);
      if (rest === "" || /^\s*\(/.test(rest)) found.add(p.title);
    }
    if (found.size > 0) break;
  }
  return [...found].slice(0, MAX_PAGES);
}

/** Saca enlaces, negritas, referencias y plantillas: deja el texto plano. */
function cleanWikitext(text: string): string {
  return text
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve el cuerpo de cada {{Lista de episodios …}} respetando llaves anidadas. */
function episodeTemplates(wikitext: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*(Lista de episodios|Episode list)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    let depth = 0;
    let i = m.index;
    for (; i < wikitext.length; i++) {
      if (wikitext.startsWith("{{", i)) { depth++; i++; }
      else if (wikitext.startsWith("}}", i)) { depth--; i++; if (depth === 0) break; }
    }
    out.push(wikitext.slice(m.index + m[0].length, i - 1));
  }
  return out;
}

/** Campos "|Nombre= valor" de una plantilla (solo los de primer nivel). */
function templateFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let depth = 0;
  let current = "";
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; current += two; i++; continue; }
    if (two === "}}" || two === "]]") { depth--; current += two; i++; continue; }
    if (body[i] === "|" && depth === 0) { parts.push(current); current = ""; continue; }
    current += body[i];
  }
  parts.push(current);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0) fields[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return fields;
}

/**
 * Títulos en español por título original normalizado.
 * Ej.: "a thing for musicians" → { title: "Atracción por los Músicos", summary: "…" }
 */
export async function getWikipediaEpisodes(names: string[]): Promise<Map<string, WikiEpisode>> {
  const map = new Map<string, WikiEpisode>();
  const pages = await findEpisodeListPages(names);
  const texts = await Promise.all(
    pages.map(async (page) => (await api<{ parse?: { wikitext: string } }>({ action: "parse", page, prop: "wikitext" }))?.parse?.wikitext ?? ""),
  );

  for (const body of texts.flatMap(episodeTemplates)) {
    const f = templateFields(body);
    const title = cleanWikitext(f["título"] ?? f["title"] ?? "");
    const alt = cleanWikitext(f["alttítulo"] ?? f["títulooriginal"] ?? f["alttitle"] ?? "");
    const summary = cleanWikitext(f["resumenbreve"] ?? f["shortsummary"] ?? "") || null;
    if (!title || !alt || normalize(title) === normalize(alt)) continue;
    // Según el anexo, el español puede estar en Título o en AltTítulo: guardamos ambos sentidos.
    map.set(normalize(alt), { title, summary });
    if (!map.has(normalize(title))) map.set(normalize(title), { title: alt, summary });
  }
  return map;
}
