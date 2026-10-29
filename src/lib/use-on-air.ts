"use client";

import { createContext, createElement, useContext, useEffect, useState } from "react";
import { channels } from "@/data/channels";
import { minutesNow } from "./schedule";
import type { LcSlot } from "./lacartoons-types";
import type { Channel, ChannelId } from "./types";

export interface OnAir {
  channel: Channel;
  status: "loading" | "ready" | "error";
  current?: LcSlot;
  next?: LcSlot;
}

function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OnAirContext = createContext<OnAir[] | null>(null);

/** Comparte una sola carga de las grillas entre todas las secciones de la página. */
export function OnAirProvider({ children }: { children: React.ReactNode }) {
  return createElement(OnAirContext.Provider, { value: useLoadOnAir() }, children);
}

/** Lo que está al aire ahora en cada canal. Requiere <OnAirProvider>. */
export function useOnAir(): OnAir[] {
  const value = useContext(OnAirContext);
  if (!value) throw new Error("useOnAir necesita <OnAirProvider>");
  return value;
}

/**
 * Carga lo que está al aire en cada canal (usa la misma grilla que /programacion).
 * La hora es la del navegador; en el servidor y la hidratación todo queda "cargando".
 */
function useLoadOnAir(): OnAir[] {
  const [now, setNow] = useState<Date | null>(null);
  const [grids, setGrids] = useState<Partial<Record<ChannelId, LcSlot[] | "error">>>({});

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dateKey = now ? toDateParam(now) : null;
  useEffect(() => {
    if (!dateKey) return;
    const controller = new AbortController();
    for (const c of channels) {
      fetch(`/api/programacion?canal=${c.id}&fecha=${dateKey}`, { signal: controller.signal })
        .then(async (r) => {
          const data: unknown = await r.json().catch(() => null);
          const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
          const slots = r.ok && body.success === true && Array.isArray(body.slots) ? (body.slots as LcSlot[]) : "error";
          setGrids((g) => ({ ...g, [c.id]: slots }));
        })
        .catch(() => {
          if (!controller.signal.aborted) setGrids((g) => ({ ...g, [c.id]: "error" }));
        });
    }
    return () => controller.abort();
  }, [dateKey]);

  const m = now ? minutesNow(now) : 0;
  return channels.map((channel) => {
    const grid = grids[channel.id];
    if (!now || grid === undefined) return { channel, status: "loading" };
    if (grid === "error") return { channel, status: "error" };
    const i = grid.findIndex((s) => m >= s.start && m < s.end);
    return { channel, status: "ready", current: grid[i], next: i >= 0 ? grid[i + 1] : undefined };
  });
}
