"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Ghost, Play, Shuffle, Tv } from "lucide-react";
import { halloweenHref, halloweenSpecials, HALLOWEEN_FROM, HALLOWEEN_UNTIL, type HalloweenSpecial } from "@/data/halloween";
import { episodeLabel } from "@/lib/lacartoons-types";
import { prefetchStreams } from "@/lib/prefetch-streams";

/** Especiales que se ven antes de "Ver todos". */
const FIRST_SHOWN = 12;

/**
 * «Especiales de Noche de Brujas»: los episodios de Halloween de las series más recordadas, en pósters.
 * Cualquiera arranca la maratón (al terminar sigue otro al azar). Solo aparece el fin de semana de
 * Halloween (la fecha es la del navegador: la página se cachea en la CDN).
 */
export default function HalloweenSpecials() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const now = Date.now();
    setVisible(now >= Date.parse(HALLOWEEN_FROM) && now < Date.parse(HALLOWEEN_UNTIL));
  }, []);
  if (!visible || halloweenSpecials.length === 0) return null;

  const seriesCount = new Set(halloweenSpecials.map((e) => e.seriesId)).size;
  const shown = all ? halloweenSpecials : halloweenSpecials.slice(0, FIRST_SHOWN);
  const startRandom = () => {
    const ep = halloweenSpecials[Math.floor(Math.random() * halloweenSpecials.length)];
    router.push(`${halloweenHref(ep)}&auto=1`);
  };

  return (
    <section
      className="chunky relative space-y-6 overflow-hidden rounded-2xl bg-[#1a0b2e] p-5 sm:p-7"
      aria-labelledby="halloween"
      style={{ backgroundImage: "radial-gradient(circle at 90% 0%, rgb(249 115 22 / 0.4), transparent 50%), radial-gradient(circle at 0% 100%, rgb(124 58 237 / 0.35), transparent 45%)" }}
    >
      <div className="checker absolute inset-x-0 top-0 h-3 opacity-40" aria-hidden />
      <span className="pointer-events-none absolute -right-4 top-6 select-none text-8xl opacity-20 sm:text-9xl" aria-hidden>
        🎃
      </span>

      <div className="relative flex flex-wrap items-end justify-between gap-5 pt-2">
        <div className="max-w-2xl space-y-2">
          <span className="sticker inline-block rounded-md bg-[#f97316] px-2.5 py-0.5 font-mono text-xl uppercase text-black">Solo este finde</span>
          <h2 id="halloween" className="flex items-center gap-3 font-display text-3xl leading-none text-[#f97316] [text-shadow:4px_4px_0_#000] sm:text-5xl">
            <Ghost className="size-8 shrink-0 text-white sm:size-11" aria-hidden /> Especiales de Noche de Brujas
          </h2>
          <p className="text-white/75">
            {halloweenSpecials.length} capítulos de Halloween de {seriesCount} series que marcaron la infancia. Elegí uno y armá tu maratón: cuando
            termina, sigue otro especial al azar.
          </p>
        </div>
        <button
          type="button"
          onClick={startRandom}
          className="chunky inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-5 py-3 font-display text-lg text-black transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
        >
          <Shuffle className="size-5" /> Empezar maratón al azar
        </button>
      </div>

      <ul className="relative grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {shown.map((ep, i) => (
          <li key={ep.id}>
            <SpecialCard ep={ep} tilt={i % 2 ? "hover:rotate-1" : "hover:-rotate-1"} />
          </li>
        ))}
      </ul>

      {halloweenSpecials.length > FIRST_SHOWN && (
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => setAll(!all)}
            aria-expanded={all}
            className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f97316]"
          >
            {all ? "Ver menos" : `Ver los ${halloweenSpecials.length} especiales`}
            <ChevronDown className={`size-4 transition-transform ${all ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
    </section>
  );
}

function SpecialCard({ ep, tilt }: { ep: HalloweenSpecial; tilt: string }) {
  return (
    <Link
      href={halloweenHref(ep)}
      onMouseEnter={() => prefetchStreams(ep.id)}
      onFocus={() => prefetchStreams(ep.id)}
      className={`group block h-full overflow-hidden rounded-xl border-4 border-black bg-black shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-1 ${tilt} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f97316] motion-reduce:transition-none`}
    >
      <div className="relative aspect-[2/3] bg-black/60">
        {ep.poster ? (
          <Image src={ep.poster} alt="" fill sizes="(min-width: 1024px) 180px, (min-width: 640px) 25vw, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <Tv className="absolute inset-0 m-auto size-10 text-white/30" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" aria-hidden />
        <span className="absolute left-2 top-2 rounded border-2 border-black bg-[#f97316] px-1.5 font-mono text-base leading-tight text-black">{episodeLabel(ep)}</span>
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
          <span className="grid size-12 place-items-center rounded-full border-4 border-black bg-[#f97316]">
            <Play className="size-6 fill-black text-black" />
          </span>
        </span>
        <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-2.5">
          <p className="line-clamp-1 text-xs font-bold uppercase tracking-wide text-[#f97316]">{ep.seriesName}</p>
          <p className="line-clamp-2 font-display text-sm leading-tight text-white">{ep.title}</p>
        </div>
      </div>
    </Link>
  );
}
