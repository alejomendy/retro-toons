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
  if (!exists && list.length + 1 >= 5) unlockAchievement("coleccionista");
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

// ── Modo «tele de verdad»: último canal y volumen ───────────────────────────

const LAST_CHANNEL_KEY = "retrotoons:ultimo-canal";
const VOLUME_KEY = "retrotoons:volumen";

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: se ignora.
  }
}

export function getLastChannel(): string | null {
  return readString(LAST_CHANNEL_KEY);
}

export function setLastChannel(channelId: string) {
  writeString(LAST_CHANNEL_KEY, channelId);
}

/** Volumen (0..1) y silencio que eligió el usuario, para volver a la tele como la dejó. */
export function getSavedVolume(): { volume: number; muted: boolean } | null {
  try {
    const parsed: unknown = JSON.parse(readString(VOLUME_KEY) ?? "null");
    if (isRecord(parsed) && isNum(parsed.volume) && typeof parsed.muted === "boolean") {
      return { volume: Math.min(1, Math.max(0, parsed.volume)), muted: parsed.muted };
    }
  } catch {
    // Valor corrupto: se ignora.
  }
  return null;
}

export function saveVolume(volume: number, muted: boolean) {
  writeString(VOLUME_KEY, JSON.stringify({ volume, muted }));
}

// ── Maratón y logros ────────────────────────────────────────────────────────

const MARATHON_KEY = "retrotoons:maraton";
const ACHIEVEMENTS_KEY = "retrotoons:logros";
const ZAPS_KEY = "retrotoons:zapping";
export const ACHIEVEMENT_EVENT = "retrotoons:logro";
/** Más de esto entre episodios corta la maratón. */
const MARATHON_GAP_MS = 2 * 60 * 60 * 1000;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

/** Logros retro que se desbloquean mirando. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: "primer-episodio", title: "¡Bienvenido a la tele!", description: "Terminaste tu primer episodio.", icon: "📺" },
  { id: "maraton-3", title: "Maratonero", description: "3 episodios seguidos de la misma serie.", icon: "🔥" },
  { id: "maraton-5", title: "Pegado a la tele", description: "5 episodios seguidos de la misma serie.", icon: "🛋️" },
  { id: "noctambulo", title: "Noctámbulo", description: "Terminaste un episodio entre la medianoche y las 5.", icon: "🌙" },
  { id: "zapping", title: "Rey del zapping", description: "Cambiaste de canal 10 veces.", icon: "📡" },
  { id: "trotamundos", title: "Trotamundos", description: "Sintonizaste los seis canales.", icon: "🗺️" },
  { id: "coleccionista", title: "Coleccionista", description: "Guardaste 5 series en favoritos.", icon: "💖" },
];

export interface Marathon {
  seriesId: string;
  seriesName: string;
  count: number;
  lastAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Desbloquea un logro (una sola vez) y avisa a la pantalla para mostrar el cartel. */
export function unlockAchievement(id: string) {
  const unlocked = readJson<Record<string, number>>(ACHIEVEMENTS_KEY, {});
  if (unlocked[id] || !ACHIEVEMENTS.some((a) => a.id === id)) return;
  unlocked[id] = Date.now();
  writeString(ACHIEVEMENTS_KEY, JSON.stringify(unlocked));
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: id }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

let achievementsCache: { raw: string | null; value: Record<string, number> } = { raw: null, value: {} };
const EMPTY_ACHIEVEMENTS: Record<string, number> = {};
function getAchievements(): Record<string, number> {
  const raw = readString(ACHIEVEMENTS_KEY);
  if (raw !== achievementsCache.raw) achievementsCache = { raw, value: readJson(ACHIEVEMENTS_KEY, {}) };
  return achievementsCache.value;
}

/** Logros desbloqueados (id → fecha). En el servidor, ninguno. */
export function useAchievements(): Record<string, number> {
  return useSyncExternalStore(subscribe, getAchievements, () => EMPTY_ACHIEVEMENTS);
}

/** Se llama al terminar un episodio: suma a la maratón y revisa logros. Devuelve la maratón actual. */
export function recordFinishedEpisode(seriesId: string, seriesName: string): Marathon {
  const prev = readJson<Marathon | null>(MARATHON_KEY, null);
  const now = Date.now();
  const same = prev && prev.seriesId === seriesId && now - prev.lastAt < MARATHON_GAP_MS;
  const marathon: Marathon = { seriesId, seriesName, count: same ? prev.count + 1 : 1, lastAt: now };
  writeString(MARATHON_KEY, JSON.stringify(marathon));
  window.dispatchEvent(new Event(CHANGE_EVENT));

  unlockAchievement("primer-episodio");
  if (marathon.count >= 3) unlockAchievement("maraton-3");
  if (marathon.count >= 5) unlockAchievement("maraton-5");
  if (new Date(now).getHours() < 5) unlockAchievement("noctambulo");
  return marathon;
}

const NO_MARATHON = null;
let marathonCache: { raw: string | null; value: Marathon | null } = { raw: null, value: null };
function getMarathon(): Marathon | null {
  const raw = readString(MARATHON_KEY);
  if (raw !== marathonCache.raw) marathonCache = { raw, value: readJson<Marathon | null>(MARATHON_KEY, null) };
  const m = marathonCache.value;
  return m && Date.now() - m.lastAt < MARATHON_GAP_MS ? m : NO_MARATHON;
}

/** Maratón en curso (si el último episodio terminó hace menos de 2 h). */
export function useMarathon(): Marathon | null {
  return useSyncExternalStore(subscribe, getMarathon, () => NO_MARATHON);
}

/** Cambio de canal en la programación: para los logros de zapping y de los seis canales. */
export function recordChannelVisit(channelId: string, totalChannels: number) {
  const state = readJson<{ zaps: number; seen: string[] }>(ZAPS_KEY, { zaps: 0, seen: [] });
  const seen = state.seen.includes(channelId) ? state.seen : [...state.seen, channelId];
  const next = { zaps: state.zaps + 1, seen };
  writeString(ZAPS_KEY, JSON.stringify(next));
  if (next.zaps >= 10) unlockAchievement("zapping");
  if (seen.length >= totalChannels) unlockAchievement("trotamundos");
}
