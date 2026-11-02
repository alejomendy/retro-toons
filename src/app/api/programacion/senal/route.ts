import { NextResponse, type NextRequest } from "next/server";
import { fetchStreamsCached } from "@/lib/lacartoons";
import { showById } from "@/data/shows";
import { getImdbIdFromTmdb, findImdbId } from "@/lib/imdb";
import { getTorrentStreams } from "@/lib/torrentio";

export const runtime = "nodejs";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/** Tope para encontrar señal: después se responde lo que haya (la tele pasa la tanda mientras tanto). */
const BUDGET_MS = 45_000;
/**
 * De a un episodio: el addon busca de a uno (Chromium en 512 MB), así que pedir más a la vez solo arma
 * cola y hace que todos lleguen tarde. Los que ya están en caché (acá o en el addon) vuelven al toque.
 */
const CONCURRENCY = 2;
const MAX_IDS = 16;
/** Espera máxima por cada episodio antes de probar el siguiente. */
const CANDIDATE_MS = 8_000;

/** "lacart_282:1:12" → "lacart_282". */
const seriesOf = (id: string) => id.split(":")[0];

/** Caché de IMDb IDs para series ya resueltas (evita llamar a TMDB en cada pedido de senal). */
const imdbIdCache = new Map<string, string | null>();

/**
 * Dado un episodeId (puede ser "lacart_NNN:S:E" o "showId:S:E"), intenta obtener streams P2P.
 * Solo aplica a series que tienen tmdbId o están en showById con datos para buscar por nombre.
 */
async function hasP2pStreams(id: string): Promise<boolean> {
  try {
    const parts = id.split(":");
    const seriesId = parts[0];
    // Solo series locales (no lacart_*) pueden tener P2P via TMDB
    if (seriesId.startsWith("lacart_")) return false;

    const season = parts.length >= 3 ? Number.parseInt(parts[1], 10) || 1 : 1;
    const episode = parts.length >= 3 ? Number.parseInt(parts[2], 10) || 1 : Number.parseInt(parts[1], 10) || 1;

    let imdbId = imdbIdCache.get(seriesId);
    if (imdbId === undefined) {
      const local = showById[seriesId];
      if (local?.tmdbId) {
        imdbId = await getImdbIdFromTmdb(local.tmdbId);
      } else if (local) {
        imdbId = await findImdbId(local.originalTitle || local.title, local.year);
      } else {
        imdbId = null;
      }
      imdbIdCache.set(seriesId, imdbId ?? null);
    }

    if (!imdbId) return false;

    const torrents = await getTorrentStreams(imdbId, season, episode);
    return torrents.length > 0;
  } catch {
    return false;
  }
}

/**
 * GET /api/programacion/senal?ids=a,b,c → { success, id }
 * Un episodio de la lista con video (probados en ese orden de preferencia), o null.
 * Lo usa la tele en vivo cuando un episodio no carga, para no mostrar nunca "Sin señal".
 * Cuando una serie falla, el servidor de sus videos suele estar caído: el resto de sus
 * episodios pasan al final y se prueban antes las otras series.
 * Si LACartoons no tiene streams, se intenta P2P (solo para series con tmdbId en showById).
 */
export async function GET(req: NextRequest) {
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ success: false, error: "Faltan episodios", code: "INVALID_ID" }, { status: 400 });

  const deadline = Date.now() + BUDGET_MS;
  // La serie del episodio que acaba de fallar va al final: lo más probable es que todos los suyos fallen igual.
  const failed = req.nextUrl.searchParams.get("fallo");
  const badSeries = new Set<string>(failed ? [seriesOf(failed)] : []);
  const busySeries = new Set<string>();
  const pending = [...ids];
  const tried: string[] = [];
  let found: string | null = null;
  // Se responde apenas aparece uno con video, sin esperar a los otros pedidos en curso.
  let done = () => {};
  const foundOne = new Promise<void>((resolve) => (done = resolve));

  const worker = async () => {
    while (!found && Date.now() < deadline) {
      // El próximo de la lista cuya serie no falló ni se está probando (de una serie, de a un episodio).
      let i = pending.findIndex((id) => !badSeries.has(seriesOf(id)) && !busySeries.has(seriesOf(id)));
      // Ya no quedan series nuevas: se prueban otros episodios de las que fallaron.
      if (i < 0 && busySeries.size === 0) i = pending.length > 0 ? 0 : -1;
      if (i < 0) return;
      const [id] = pending.splice(i, 1);
      busySeries.add(seriesOf(id));
      // Si el addon tarda, se pasa al siguiente; la búsqueda sigue sola y queda en caché para la próxima.
      const ok = await Promise.race([
        fetchStreamsCached(id)
          .then((s) => s.length > 0)
          .catch(() => false)
          .then(async (lcOk) => {
            // Si LACartoons no tiene streams, intentar P2P como fallback
            if (!lcOk && !id.startsWith("lacart_")) {
              return await hasP2pStreams(id).catch(() => false);
            }
            return lcOk;
          }),
        new Promise<boolean>((r) => setTimeout(() => r(false), CANDIDATE_MS)),
      ]);
      busySeries.delete(seriesOf(id));
      tried.push(id);
      if (ok) {
        found ??= id;
        done();
      } else badSeries.add(seriesOf(id));
    }
  };
  await Promise.race([Promise.all(Array.from({ length: CONCURRENCY }, worker)), foundOne, new Promise((r) => setTimeout(r, BUDGET_MS))]);

  // `tried`: los que ya se probaron, para que la tele siga pidiendo con el resto si no hubo suerte.
  return NextResponse.json({ success: true, id: found, tried }, { headers: { "Cache-Control": "no-store" } });
}
