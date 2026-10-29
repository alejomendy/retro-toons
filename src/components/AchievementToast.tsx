"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENT_EVENT, ACHIEVEMENTS, type Achievement } from "@/lib/user-library";

const SHOW_MS = 6000;

/** Cartel de «¡Logro desbloqueado!» que aparece en cualquier página. */
export default function AchievementToast() {
  const [shown, setShown] = useState<Achievement | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onUnlock = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      if (!achievement) return;
      setShown(achievement);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShown(null), SHOW_MS);
    };
    window.addEventListener(ACHIEVEMENT_EVENT, onUnlock);
    return () => {
      window.removeEventListener(ACHIEVEMENT_EVENT, onUnlock);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      {shown && (
        <div key={shown.id} className="lower-third chunky pointer-events-auto flex items-center gap-3 rounded-xl bg-accent px-4 py-3 text-black">
          <span className="text-3xl" aria-hidden>
            {shown.icon}
          </span>
          <div>
            <p className="font-mono text-lg leading-none">¡LOGRO DESBLOQUEADO!</p>
            <p className="font-display text-lg leading-tight">{shown.title}</p>
            <p className="text-sm">{shown.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
