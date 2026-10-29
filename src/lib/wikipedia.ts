import "server-only";

/**
 * Wikipedia en español (https://es.wikipedia.org/api/rest_v1/) — sin API key.
 * Da una descripción en español y una imagen cuando TMDB no está configurado.
 * Contenido bajo CC BY-SA: mostramos el enlace al artículo.
 */
const ONE_WEEK = 60 * 60 * 24 * 7;
const HEADERS = { "User-Agent": "RetroToons/1.0 (proyecto de fans)" };

export interface WikiSummary {
  title: string;
  extract: string;
  image: string | null;
  url: string;
}

export async function getWikipediaSummary(query: string): Promise<WikiSummary | null> {
  try {
    const opts = { headers: HEADERS, next: { revalidate: ONE_WEEK }, signal: AbortSignal.timeout(6000) };
    const search = await fetch(
      `https://es.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`,
      opts,
    );
    if (!search.ok) return null;
    const key = ((await search.json()) as { pages: { key: string }[] }).pages[0]?.key;
    if (!key) return null;

    const res = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`, opts);
    if (!res.ok) return null;
    const page = (await res.json()) as {
      title: string;
      extract: string;
      thumbnail?: { source: string };
      content_urls: { desktop: { page: string } };
    };
    return {
      title: page.title,
      extract: page.extract,
      image: page.thumbnail?.source ?? null,
      url: page.content_urls.desktop.page,
    };
  } catch {
    return null;
  }
}
