import "server-only";
import fs from "fs";
import path from "path";

/**
 * Qué episodios se pudieron ver de verdad y cuáles no tienen video, para armar la grilla con lo que anda.
 *
 * - "ok": el reproductor (biblioteca o tele en vivo) llegó a reproducirlo.
 * - "bad": no tuvo ninguna fuente, o todas fallaron / eran videos de reemplazo.
 *
 * Se guarda en disco (sobrevive a los reinicios). Los "bad" vencen a la semana: las fuentes a veces vuelven.
 * Las claves son los IDs de episodio de la grilla ("lacart_395:23:8", o "<serie local>:<número>").
 */

const FILE = process.env.EPISODE_HEALTH_FILE?.trim() || path.join(process.cwd(), ".retrotoons-cache", "episodios.json");
const BAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Se escribe a disco como mucho cada tanto (muchos reportes juntos al hacer zapping). */
const SAVE_DELAY_MS = 5000;
/** Una serie con tantos episodios rotos y ninguno que ande se da por caída (no entra a la grilla). */
const DEAD_SERIES_BAD = 5;

type Entry = { s: "ok" | "bad"; at: number };
type Store = Record<string, Entry>;

declare global {
  var __episodeHealth: Store | undefined;
  var __episodeHealthTimer: ReturnType<typeof setTimeout> | undefined;
}

function load(): Store {
  if (globalThis.__episodeHealth) return globalThis.__episodeHealth;
  let store: Store = {};
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    // Primera vez (o archivo dañado): se empieza vacío.
  }
  globalThis.__episodeHealth = store;
  return store;
}

function scheduleSave() {
  if (globalThis.__episodeHealthTimer) return;
  globalThis.__episodeHealthTimer = setTimeout(() => {
    globalThis.__episodeHealthTimer = undefined;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(load()));
    } catch (e) {
      // En hosts de solo lectura queda en memoria.
      console.warn("[salud] No se pudo guardar el registro de episodios:", e);
    }
  }, SAVE_DELAY_MS);
}

export const seriesOfEpisode = (episodeId: string) => episodeId.split(":")[0];

/** Anota el resultado de un episodio. Un "ok" no se pisa con un "bad" pasajero de la misma hora. */
export function reportEpisode(episodeId: string, ok: boolean): void {
  if (!/^[\w-]+(:\d+){1,2}$/.test(episodeId)) return;
  const store = load();
  const prev = store[episodeId];
  if (!ok && prev?.s === "ok" && Date.now() - prev.at < 60 * 60 * 1000) return;
  if (prev && prev.s === (ok ? "ok" : "bad") && Date.now() - prev.at < 60 * 1000) return;
  store[episodeId] = { s: ok ? "ok" : "bad", at: Date.now() };
  scheduleSave();
}

export interface SeriesHealth {
  ok: Set<string>;
  bad: Set<string>;
}

/** Estado de los episodios de todas las series (los "bad" vencidos no cuentan). */
export function healthBySeries(): Map<string, SeriesHealth> {
  const out = new Map<string, SeriesHealth>();
  const now = Date.now();
  for (const [id, entry] of Object.entries(load())) {
    if (entry.s === "bad" && now - entry.at > BAD_TTL_MS) continue;
    const series = seriesOfEpisode(id);
    let h = out.get(series);
    if (!h) out.set(series, (h = { ok: new Set(), bad: new Set() }));
    h[entry.s].add(id);
  }
  return out;
}

/** ¿La serie no tiene ningún episodio que ande y ya fallaron varios? */
export const isDeadSeries = (h: SeriesHealth | undefined) => !!h && h.ok.size === 0 && h.bad.size >= DEAD_SERIES_BAD;
