import { NextResponse, type NextRequest } from "next/server";
import { fetchStreamsCached } from "@/lib/lacartoons";

export const runtime = "nodejs";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/** Tope para encontrar señal: después se responde lo que haya (la tele pasa la tanda mientras tanto). */
const BUDGET_MS = 45_000;
/**
 * De a un episodio: el addon busca de a uno (Chromium en 512 MB), así que pedir más a la vez solo arma
 * cola y hace que todos lleguen tarde. Los que ya están en caché (acá o en el addon) vuelven al toque.
 */
const CONCURRENCY = 1;
const MAX_IDS = 16;
/** Espera máxima por cada episodio antes de probar el siguiente. */
const CANDIDATE_MS = 15_000;

/** "lacart_282:1:12" → "lacart_282". */
const seriesOf = (id: string) => id.split(":")[0];

/**
 * GET /api/programacion/senal?ids=a,b,c → { success, id }
 * Un episodio de la lista con video (probados en ese orden de preferencia), o null.
 * Lo usa la tele en vivo cuando un episodio no carga, para no mostrar nunca "Sin señal".
 * Cuando una serie falla, el servidor de sus videos suele estar caído: el resto de sus
 * episodios pasan al final y se prueban antes las otras series.
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
          .catch(() => false),
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
