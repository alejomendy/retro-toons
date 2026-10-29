"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { channelNumber, channels } from "@/data/channels";
import { formatTime, minutesNow } from "@/lib/schedule";
import { episodeLabel, watchHref, type LcSlot } from "@/lib/lacartoons-types";
import { prefetchStreams } from "@/lib/prefetch-streams";
import type { ChannelId } from "@/lib/types";

/** Ancho de un minuto en la grilla (px): un espacio de 30 min mide 150 px. */
const PX_PER_MIN = 5;
const DAY_MINUTES = 24 * 60;
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Grids = Partial<Record<ChannelId, LcSlot[] | "error">>;

function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Guía de todos los canales a la vez, como la del cable: canales en filas, horas en columnas.
 * Lo que está al aire lleva a sintonizar el canal; el resto se abre en la biblioteca.
 */
export default function GuiaClient() {
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [grids, setGrids] = useState<{ day: string; data: Grids }>({ day: "", data: {} });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = now ? toDateParam(now) : null;
  const day = selected ?? today;
  const isToday = day === today;
  const week = now
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + i);
        return d;
      })
    : [];

  // Las grillas de los seis canales para el día elegido (en caché del servidor: responden rápido).
  useEffect(() => {
    if (!day) return;
    const controller = new AbortController();
    setGrids({ day, data: {} });
    for (const c of channels) {
      fetch(`/api/programacion?canal=${c.id}&fecha=${day}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { success?: boolean; slots?: LcSlot[] }) =>
          setGrids((g) => (g.day === day ? { day, data: { ...g.data, [c.id]: data.success && data.slots ? data.slots : "error" } } : g)),
        )
        .catch(() => {
          if (!controller.signal.aborted) setGrids((g) => (g.day === day ? { day, data: { ...g.data, [c.id]: "error" } } : g));
        });
    }
    return () => controller.abort();
  }, [day]);

  // Al abrir (o cambiar de día) se muestra desde un rato antes de ahora; los otros días, desde la tarde.
  const nowMin = now ? minutesNow(now) : 0;
  useEffect(() => {
    if (!scrollRef.current || !day) return;
    const from = isToday ? Math.max(0, nowMin - 30) : 14 * 60;
    scrollRef.current.scrollLeft = from * PX_PER_MIN;
    // Solo al cambiar de día, no en cada tic del reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Días de la semana">
        {week.map((d) => {
          const key = toDateParam(d);
          const active = key === day;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(key)}
              className={`chunky rounded-lg px-3 py-1 font-mono text-xl transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
                active ? "-translate-y-0.5 bg-accent text-black" : "bg-panel text-white/80 hover:text-white"
              }`}
            >
              {key === today ? "Hoy" : `${WEEKDAYS[d.getDay()]} ${d.getDate()}`}
            </button>
          );
        })}
      </div>

      <div className="chunky overflow-hidden rounded-xl bg-panel">
        {/* Se puede desplazar con el teclado (flechas) al enfocar la guía. */}
        <div ref={scrollRef} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent" tabIndex={0} role="region" aria-label="Guía de canales, desplazable de izquierda a derecha">
          <div className="relative" style={{ width: DAY_MINUTES * PX_PER_MIN + CHANNEL_COL }}>
            {/* Regla de horas */}
            <div className="sticky top-0 z-20 flex border-b-4 border-black bg-black">
              <div className="sticky left-0 z-30 shrink-0 border-r-4 border-black bg-black" style={{ width: CHANNEL_COL }} />
              <div className="relative h-8 flex-1">
                {Array.from({ length: 48 }, (_, i) => (
                  <span key={i} className="absolute top-1 font-mono text-lg text-white/70" style={{ left: i * 30 * PX_PER_MIN + 6 }}>
                    {formatTime(i * 30)}
                  </span>
                ))}
              </div>
            </div>

            {channels.map((c) => {
              const grid = grids.day === day ? grids.data[c.id] : undefined;
              return (
                <div key={c.id} className="flex border-b-2 border-black/60">
                  <Link
                    href={`/programacion?canal=${c.id}`}
                    className="sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-0.5 border-r-4 border-black px-3 py-2 transition-[filter] hover:brightness-110"
                    style={{ width: CHANNEL_COL, backgroundColor: c.color, color: c.ink }}
                    title={`Sintonizar ${c.name}`}
                  >
                    <span className="font-mono text-xl leading-none opacity-80">CH {channelNumber(c.id)}</span>
                    <span className="truncate font-display text-xs leading-tight sm:text-sm">{c.name}</span>
                  </Link>
                  <div className="relative h-20 flex-1">
                    {grid === undefined && <div className="absolute inset-2 animate-pulse rounded-lg bg-white/5" />}
                    {grid === "error" && <p className="absolute inset-y-0 left-4 flex items-center font-mono text-lg text-white/65">Sin señal por ahora</p>}
                    {Array.isArray(grid) &&
                      grid.map((s) => {
                        const live = isToday && nowMin >= s.start && nowMin < s.end;
                        const past = isToday && s.end <= nowMin;
                        const cls = `absolute inset-y-1.5 flex flex-col justify-center overflow-hidden rounded-lg border-2 px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
                          live ? "border-black bg-[#ff3ea5] text-white shadow-[3px_3px_0_#000]" : "border-black/60 bg-black/35 text-white hover:bg-white/15"
                        } ${past ? "opacity-45" : ""}`;
                        const style = { left: s.start * PX_PER_MIN + 2, width: (s.end - s.start) * PX_PER_MIN - 4 };
                        // Para lectores de pantalla: todo lo que dice la casilla, en una frase.
                        const label = `${c.name}, ${formatTime(s.start)}${live ? ", al aire" : ""}: ${s.series.name}, ${episodeLabel(s.episode)}, ${s.episode.title}`;
                        const content = (
                          <>
                            <span className="flex items-center gap-1.5 font-mono text-base leading-none text-white/75">
                              {formatTime(s.start)}
                              {live && <span className="blink rounded bg-red-600 px-1 text-xs text-white">AHORA</span>}
                            </span>
                            <span className="truncate text-sm font-bold leading-tight">{s.series.name}</span>
                            <span className="truncate text-xs text-white/70">
                              {episodeLabel(s.episode)} · {s.episode.title}
                            </span>
                          </>
                        );
                        // Al aire: sintonizar el canal. Lo demás: verlo en la biblioteca (o en su fuente original).
                        if (live) {
                          return (
                            <Link key={s.start} href={`/programacion?canal=${c.id}`} className={cls} style={style} aria-label={label} title={`Sintonizar ${c.name}`}>
                              {content}
                            </Link>
                          );
                        }
                        if (s.external) {
                          return s.external.url ? (
                            <a key={s.start} href={s.external.url} target="_blank" rel="noreferrer" className={cls} style={style} aria-label={label}>
                              {content}
                            </a>
                          ) : (
                            <div key={s.start} className={cls} style={style} aria-label={label}>
                              {content}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={s.start}
                            href={watchHref(s.series.id, s.episode.id)}
                            className={cls}
                            style={style}
                            aria-label={label}
                            onMouseEnter={() => prefetchStreams(s.episode.id)}
                            onFocus={() => prefetchStreams(s.episode.id)}
                            title={`Ver ${s.series.name} en la biblioteca`}
                          >
                            {content}
                          </Link>
                        );
                      })}
                  </div>
                </div>
              );
            })}

            {/* Línea de "ahora" */}
            {isToday && now && (
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-10 w-0.5 bg-red-500 shadow-[0_0_8px_rgb(239_68_68)]"
                style={{ left: CHANNEL_COL + nowMin * PX_PER_MIN }}
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>
      <p className="font-mono text-lg text-white/65">Tocá lo que está al aire para sintonizar el canal, o cualquier otro programa para verlo en la biblioteca.</p>
    </div>
  );
}

/** Ancho de la columna de canales (px). */
const CHANNEL_COL = 132;
