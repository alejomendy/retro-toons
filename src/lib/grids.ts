"use client";

import type { LcSlot } from "./lacartoons-types";
import type { ChannelId } from "./types";

/** Grilla de cada canal para un día; `null` si la de ese canal no se pudo armar. */
export type DayGrids = Record<ChannelId, LcSlot[] | null>;

const cache = new Map<string, Promise<DayGrids>>();

/**
 * Las grillas de los seis canales para un día (`AAAA-MM-DD`), en un solo pedido compartido
 * por toda la pestaña: la tele, el "ahora en", la guía y el zapping usan la misma respuesta.
 */
export function loadGrids(fecha: string): Promise<DayGrids> {
  const hit = cache.get(fecha);
  if (hit) return hit;
  const promise = fetch(`/api/programacion?canal=todos&fecha=${fecha}`)
    .then(async (r) => {
      const data = (await r.json().catch(() => null)) as { success?: boolean; grids?: DayGrids } | null;
      if (!r.ok || !data?.success || !data.grids) throw new Error("Sin grillas");
      // Si algún canal vino vacío, la próxima vez se vuelve a pedir.
      if (Object.values(data.grids).some((g) => !g)) setTimeout(() => cache.delete(fecha), 30_000);
      return data.grids;
    })
    .catch((e) => {
      cache.delete(fecha);
      throw e;
    });
  cache.set(fecha, promise);
  return promise;
}

/** Olvida las grillas guardadas de un día (para el botón de reintentar). */
export function forgetGrids(fecha: string): void {
  cache.delete(fecha);
}

export function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
