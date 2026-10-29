"use client";

import { useSyncExternalStore } from "react";

/**
 * Favoritos y "Continuar viendo", guardados en localStorage.
 * Solo se toca localStorage dentro de funciones que corren en el navegador;
 * durante el render del servidor (y la hidratación) los hooks devuelven listas vacías.
 * Nunca se guardan URLs de streams (caducan): solo IDs y datos para mostrar.
 */

export interface FavoriteSeries {
  id: string;
  name: string;
  poster: string | null;
  addedAt: number;
}

export interface WatchProgress {
  seriesId: string;
  seriesName: string;
  poster: string | null;
  episodeId: string;
  episodeTitle: string;
  season: number;
  episode: number;
  /** Segundos. */
  position: number;
  duration: number;
  updatedAt: number;
}

const FAVORITES_KEY = "retrotoons:favoritos:v1";
const PROGRESS_KEY = "retrotoons:progreso:v1";
const CHANGE_EVENT = "retrotoons:library-change";
const MAX_PROGRESS = 30;

/** Se considera terminado si queda menos de esto (o pasó el 95%). */
const FINISHED_REMAINING_SECONDS = 45;
const FINISHED_RATIO = 0.95;

export function isFinished(position: number, duration: number): boolean {
  if (!(duration > 0)) return false;
  return duration - position < FINISHED_REMAINING_SECONDS || position / duration > FINISHED_RATIO;
}

// ── Almacenamiento con caché de snapshot (useSyncExternalStore exige referencias estables) ──

const cache = new Map<string, { raw: string | null; value: unknown[] }>();
const EMPTY: never[] = [];

function readList<T>(key: string, isItem: (v: unknown) => v is T): T[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed.filter(isItem) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache.set(key, { raw, value });
  return value;
}

function writeList<T>(key: string, list: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Almacenamiento lleno o bloqueado (modo privado): se ignora.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // otras pestañas
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPoster = (v: unknown) => v === null || isStr(v);

function isFavorite(v: unknown): v is FavoriteSeries {
  return isRecord(v) && isStr(v.id) && isStr(v.name) && isPoster(v.poster) && isNum(v.addedAt);
}

function isProgress(v: unknown): v is WatchProgress {
  return (
    isRecord(v) &&
    isStr(v.seriesId) &&
    isStr(v.seriesName) &&
    isPoster(v.poster) &&
    isStr(v.episodeId) &&
    isStr(v.episodeTitle) &&
    isNum(v.season) &&
    isNum(v.episode) &&
    isNum(v.position) &&
    isNum(v.duration) &&
    isNum(v.updatedAt)
  );
}

const getFavorites = () => readList(FAVORITES_KEY, isFavorite);
const getProgress = () => readList(PROGRESS_KEY, isProgress);
const getServerSnapshot = () => EMPTY;

// ── Favoritos ───────────────────────────────────────────────────────────────

export function useFavorites(): FavoriteSeries[] {
  return useSyncExternalStore(subscribe, getFavorites, getServerSnapshot);
}

export function toggleFavorite(series: Omit<FavoriteSeries, "addedAt">): boolean {
  const list = getFavorites();
  const exists = list.some((f) => f.id === series.id);
  writeList(
    FAVORITES_KEY,
    exists ? list.filter((f) => f.id !== series.id) : [{ ...series, addedAt: Date.now() }, ...list],
  );
  return !exists;
}

export function removeFavorite(id: string) {
  writeList(FAVORITES_KEY, getFavorites().filter((f) => f.id !== id));
}

// ── Continuar viendo ────────────────────────────────────────────────────────

/** Una entrada por serie (el último episodio visto), de la más reciente a la más vieja. */
export function useContinueWatching(): WatchProgress[] {
  return useSyncExternalStore(subscribe, getProgress, getServerSnapshot);
}

export function getSeriesProgress(seriesId: string): WatchProgress | undefined {
  return getProgress().find((p) => p.seriesId === seriesId);
}

export function saveProgress(entry: Omit<WatchProgress, "updatedAt">) {
  const rest = getProgress().filter((p) => p.seriesId !== entry.seriesId);
  writeList(PROGRESS_KEY, [{ ...entry, updatedAt: Date.now() }, ...rest].slice(0, MAX_PROGRESS));
}

export function removeProgress(seriesId: string) {
  writeList(PROGRESS_KEY, getProgress().filter((p) => p.seriesId !== seriesId));
}
