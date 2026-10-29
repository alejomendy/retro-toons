/** Minúsculas, sin acentos ni signos: para comparar títulos de distintas fuentes. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * true si el título menciona el episodio. Los nombres con segmentos
 * ("A/B") cuentan con que aparezca uno. Sin nombres útiles, no filtra.
 */
export function mentionsEpisode(title: string, episodeNames: string[]): boolean {
  const parts = episodeNames
    .flatMap((n) => n.split("/"))
    .map(normalize)
    .filter((p) => p.length >= 4);
  if (parts.length === 0) return true;
  const t = normalize(title);
  return parts.some((p) => t.includes(p));
}

/** true si el título incluye alguno de los nombres de la serie. */
export function mentionsSeries(title: string, seriesNames: string[]): boolean {
  const t = normalize(title);
  return seriesNames.some((n) => {
    const name = normalize(n);
    return name.length > 0 && t.includes(name);
  });
}
