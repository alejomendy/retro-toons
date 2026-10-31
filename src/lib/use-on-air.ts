"use client";

import { createContext, createElement, useContext, useEffect, useState } from "react";
import { channels } from "@/data/channels";
import { minutesNow } from "./schedule";
import { forgetGrids, loadGrids, toDateParam } from "./grids";

/** Si no llegaron las grillas, se vuelven a pedir pasado este tiempo. */
const RETRY_MS = 15_000;
import type { LcSlot } from "./lacartoons-types";
import type { Channel, ChannelId } from "./types";

export interface OnAir {
  channel: Channel;
  status: "loading" | "ready" | "error";
  current?: LcSlot;
  next?: LcSlot;
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
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!dateKey) return;
    let cancelled = false;
    let timer: number | undefined;
    // Si falta alguna grilla se vuelve a pedir en un rato: los canales siguen "sintonizando", nunca "sin señal".
    const again = () => {
      timer = window.setTimeout(() => {
        forgetGrids(dateKey);
        setRetry((n) => n + 1);
      }, RETRY_MS);
    };
    loadGrids(dateKey)
      .then((all) => {
        if (cancelled) return;
        setGrids(Object.fromEntries(channels.map((c) => [c.id, all[c.id] ?? "error"])));
        if (channels.some((c) => !all[c.id])) again();
      })
      .catch(() => {
        if (!cancelled) again();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dateKey, retry]);

  const m = now ? minutesNow(now) : 0;
  return channels.map((channel) => {
    const grid = grids[channel.id];
    if (!now || grid === undefined || grid === "error") return { channel, status: "loading" };
    const i = grid.findIndex((s) => m >= s.start && m < s.end);
    return { channel, status: "ready", current: grid[i], next: i >= 0 ? grid[i + 1] : undefined };
  });
}
