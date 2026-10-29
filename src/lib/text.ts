/** Minúsculas, sin acentos ni signos: para comparar títulos de distintas fuentes. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** true si el título incluye alguno de los nombres de la serie. */
export function mentionsSeries(title: string, seriesNames: string[]): boolean {
  const t = normalize(title);
  return seriesNames.some((n) => {
    const name = normalize(n);
    return name.length > 0 && t.includes(name);
  });
}
