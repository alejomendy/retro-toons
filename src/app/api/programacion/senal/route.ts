import { NextResponse, type NextRequest } from "next/server";
import { fetchStreamsCached } from "@/lib/lacartoons";
import { showById } from "@/data/shows";
import playableList from "@/data/playable.json";
import { getImdbIdFromTmdb, findImdbId } from "@/lib/imdb";
import { getTorrentStreams } from "@/lib/torrentio";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Tope para encontrar señal: después se responde lo que haya. */
const BUDGET_MS = 30_000;
/**
 * Concurrencia de búsqueda: 3 trabajadores en paralelo.
 */
const CONCURRENCY = 3;
const MAX_IDS = 16;
/** Espera máxima por cada episodio antes de probar el siguiente. */
const CANDIDATE_MS = 5_000;

/** "lacart_282:1:12" → "lacart_282". */
const seriesOf = (id: string) => id.split(":")[0];

/** Caché de IMDb IDs para evitar llamar a TMDB en cada prueba de señal. */
const imdbResolved = new Map<string, { imdbId: string | null; isAnime: boolean }>();

async function resolveImdb(seriesId: string): Promise<{ imdbId: string | null; isAnime: boolean }> {
  const cached = imdbResolved.get(seriesId);
  if (cached) return cached;

  let isAnime = false;
  let imdbId: string | null = null;

  const local = showById[seriesId];
  if (local) {
    isAnime = local.genre?.toLowerCase().includes("anime") || (local.channels && local.channels.length === 0);
    if (local.tmdbId) {
      imdbId = await getImdbIdFromTmdb(local.tmdbId);
    } else {
      imdbId = await findImdbId(local.originalTitle || local.title, local.year);
    }
  } else {
    const pName = (playableList.series as Record<string, { name: string } | undefined>)[seriesId]?.name;
    if (pName) {
      isAnime = /dragon ball|saint seiya|caballeros|sailor moon|ranma|pokemon|digimon|evangelion|inuyasha|sakura|yugioh|yu-gi-oh|slam dunk|samurai x|samurai champloo|cowboy bebop|trigun|zatch|shaman|beyblade|medabots|detective conan|mazinger|attack on titan|shingeki|demon slayer|kimetsu|jujutsu|hunter x hunter|bleach|naruto|one piece/i.test(pName);
      imdbId = await findImdbId(pName);
    }
  }

  const result = { imdbId, isAnime };
  imdbResolved.set(seriesId, result);
  return result;
}

/**
 * Verifica si un episodio tiene torrents activos en Torrentio P2P con audio latino o subtítulos en español.
 */
async function hasP2pStreams(id: string): Promise<boolean> {
  try {
    const parts = id.split(":");
    const seriesId = parts[0];
    const season = parts.length >= 3 ? Number.parseInt(parts[1], 10) || 1 : 1;
    const episode = parts.length >= 3 ? Number.parseInt(parts[2], 10) || 1 : Number.parseInt(parts[1], 10) || 1;

    const { imdbId, isAnime } = await resolveImdb(seriesId);
    if (!imdbId) return false;

    const torrents = await getTorrentStreams(imdbId, season, episode, { isAnime });
    return torrents.length > 0;
  } catch {
    return false;
  }
}

/**
 * GET /api/programacion/senal?ids=a,b,c → { success, id }
 * Prueba en paralelo y con preferencia absoluta en Torrentio P2P para asegurar señal
 * rápida y confiable en la tele en vivo, dejando LACartoons como fallback secundario.
 */
export async function GET(req: NextRequest) {
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ success: false, error: "Faltan episodios", code: "INVALID_ID" }, { status: 400 });

  const deadline = Date.now() + BUDGET_MS;
  const failed = req.nextUrl.searchParams.get("fallo");
  const badSeries = new Set<string>(failed ? [seriesOf(failed)] : []);
  const busySeries = new Set<string>();
  const pending = [...ids];
  const tried: string[] = [];
  let found: string | null = null;
  let done = () => {};
  const foundOne = new Promise<void>((resolve) => (done = resolve));

  const worker = async () => {
    while (!found && Date.now() < deadline) {
      let i = pending.findIndex((id) => !badSeries.has(seriesOf(id)) && !busySeries.has(seriesOf(id)));
      if (i < 0 && busySeries.size === 0) i = pending.length > 0 ? 0 : -1;
      if (i < 0) return;
      const [id] = pending.splice(i, 1);
      busySeries.add(seriesOf(id));

      // 1. Probar primero Torrentio P2P (ultra rápido y confiable)
      let ok = await hasP2pStreams(id).catch(() => false);

      // 2. Si no tiene P2P, probar LACartoons con timeout de candidato
      if (!ok) {
        ok = await Promise.race([
          fetchStreamsCached(id)
            .then((s) => s.length > 0)
            .catch(() => false),
          new Promise<boolean>((r) => setTimeout(() => r(false), CANDIDATE_MS)),
        ]);
      }

      busySeries.delete(seriesOf(id));
      tried.push(id);
      if (ok) {
        found ??= id;
        done();
      } else badSeries.add(seriesOf(id));
    }
  };

  await Promise.race([
    Promise.all(Array.from({ length: CONCURRENCY }, worker)),
    foundOne,
    new Promise((r) => setTimeout(r, BUDGET_MS)),
  ]);

  return NextResponse.json({ success: true, id: found, tried }, { headers: { "Cache-Control": "no-store" } });
}
