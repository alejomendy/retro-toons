import "server-only";
import { fetchStreamsCached } from "./lacartoons";
import { healthBySeries, reportEpisode, seriesOfEpisode } from "./episode-health";
import { episodeTorrents, resolveSeriesImdb } from "./series-imdb";
import type { LcSlot } from "./lacartoons-types";

/**
 * Verificador anticipado: revisa en segundo plano los episodios de LACartoons que van a salir en las
 * próximas horas. Los que no tienen video quedan anotados (lib/episode-health.ts) y la grilla, que se
 * rearma cada hora, los cambia por otros. Los que sí tienen quedan con su link en caché y arrancan al
 * instante. Va de a un episodio por vez: el addon extrae los videos de a uno.
 */

/** Cuánto hacia adelante se revisa (minutos). */
const AHEAD_MINUTES = 3 * 60;
/** Un episodio ya revisado no se vuelve a revisar por este tiempo. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

/** Mientras alguien espera las fuentes de un episodio, el verificador no le ocupa el addon. */
const VIEWER_PAUSE_MS = 2000;

declare global {
  var __warmQueue: string[] | undefined;
  var __warmChecked: Map<string, number> | undefined;
  var __warmRunning: boolean | undefined;
  var __viewersWaiting: number | undefined;
}

/** La ruta de fuentes avisa que un espectador está esperando; devuelve la función para avisar que terminó. */
export function viewerWaiting(): () => void {
  globalThis.__viewersWaiting = (globalThis.__viewersWaiting ?? 0) + 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    globalThis.__viewersWaiting = Math.max(0, (globalThis.__viewersWaiting ?? 1) - 1);
  };
}

const queue = () => (globalThis.__warmQueue ??= []);
const checked = () => (globalThis.__warmChecked ??= new Map());

/** Encola los episodios de los espacios que empiezan en las próximas horas (los más cercanos primero). */
export function warmUpcoming(slots: LcSlot[], fecha: string): void {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (fecha !== today) return;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const health = healthBySeries();
  const known = (id: string) => {
    const h = health.get(seriesOfEpisode(id));
    return !!h && (h.ok.has(id) || h.bad.has(id));
  };

  const upcoming = slots
    .filter((s) => !s.external && s.series.id.startsWith("lacart_") && s.end > nowMin && s.start < nowMin + AHEAD_MINUTES)
    .sort((a, b) => a.start - b.start);
  for (const slot of upcoming) {
    // El de la grilla y la primera reserva: si el principal falla, la tele pasa a esa.
    for (const id of [slot.episode.id, slot.more?.[0]?.id].filter((x): x is string => !!x)) {
      if (known(id) || queue().includes(id) || Date.now() - (checked().get(id) ?? 0) < RECHECK_MS) continue;
      queue().push(id);
    }
  }
  void drain();
}

async function drain(): Promise<void> {
  if (globalThis.__warmRunning) return;
  globalThis.__warmRunning = true;
  try {
    for (let id = queue().shift(); id; id = queue().shift()) {
      while ((globalThis.__viewersWaiting ?? 0) > 0) await new Promise((r) => setTimeout(r, VIEWER_PAUSE_MS));
      checked().set(id, Date.now());
      await checkEpisode(id).catch(() => {});
    }
  } finally {
    globalThis.__warmRunning = false;
  }
}

async function checkEpisode(id: string): Promise<void> {
  const [series, season, episode] = id.split(":");
  // Con torrent en español ya tiene fuente: no hace falta ocupar al addon.
  const { imdbId, isAnime } = await resolveSeriesImdb(series);
  if (imdbId && (await episodeTorrents(imdbId, Number(season), Number(episode), { isAnime }).catch(() => [])).length > 0) return;
  // fetchStreamsCached devuelve [] solo si el addon contestó que no hay video (un error se lanza).
  const streams = await fetchStreamsCached(id);
  if (streams.length === 0) reportEpisode(id, false);
}
