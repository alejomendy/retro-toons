"use client";

import { ACHIEVEMENTS, useAchievements } from "@/lib/user-library";
import { SectionTitle } from "@/components/PageHeader";

/** Logros retro: los desbloqueados a color, los que faltan en gris con la pista de cómo conseguirlos. */
export default function AchievementsSection() {
  const unlocked = useAchievements();
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <section className="space-y-4" aria-labelledby="logros">
      <SectionTitle id="logros" aside={<span className="font-mono text-xl text-white/70">{count} de {ACHIEVEMENTS.length}</span>}>
        Logros
      </SectionTitle>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.id];
          return (
            <li
              key={a.id}
              className={`chunky flex flex-col items-center gap-1 rounded-xl p-3 text-center ${at ? "bg-accent text-black" : "bg-panel text-white/70"}`}
              aria-label={`${a.title}: ${a.description} ${at ? "Desbloqueado" : "Bloqueado"}`}
            >
              <span className={`text-3xl ${at ? "" : "opacity-40 grayscale"}`} aria-hidden>
                {a.icon}
              </span>
              <span className="font-display text-xs leading-tight sm:text-sm">{a.title}</span>
              <span className={`text-xs leading-snug ${at ? "text-black/75" : "text-white/65"}`}>{a.description}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
