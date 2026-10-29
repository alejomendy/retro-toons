"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "retrotoons:modo-cine";

/**
 * Modo cine estilo YouTube: el reproductor ocupa todo el ancho de la página y el resto baja.
 * Se recuerda en este navegador (solo se lee después de hidratar, nunca en el servidor). Esc lo apaga.
 */
export function useTheaterMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch {
      // Sin acceso a localStorage (modo privado): arranca apagado.
    }
  }, []);

  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Ídem: el modo funciona igual, solo no se recuerda.
    }
  }, []);

  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      // No interferir mientras se escribe en un campo.
      const target = e.target as HTMLElement | null;
      if (e.key === "Escape" && !target?.closest("input, textarea, select")) set(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, set]);

  return [on, set];
}

/** Clases de la franja a todo el ancho que envuelve al reproductor en modo cine. */
export const theaterBand = "relative left-1/2 w-screen -translate-x-1/2 border-y-4 border-black bg-black/85 px-2 py-3 sm:px-6 sm:py-5";
/** Ancho del reproductor en modo cine: todo lo que entra sin pasarse del alto de la ventana. */
export const theaterWidth = "mx-auto w-full max-w-[calc((100dvh-12rem)*16/9)]";
