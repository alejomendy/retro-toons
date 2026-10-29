import type { Show } from "@/lib/types";

/** Portada generada con la paleta de la serie (no usamos arte oficial). */
export default function ShowCover({ show, className = "" }: { show: Show; className?: string }) {
  const [a, b] = show.palette;
  return (
    <div
      className={`relative grid aspect-[4/3] place-items-center overflow-hidden p-4 text-center ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, ${a} 0 22px, color-mix(in srgb, ${a} 82%, ${b}) 22px 44px)` }}
    >
      <span
        className="absolute -right-6 -top-6 size-24 rounded-full border-4 border-black"
        style={{ backgroundColor: b }}
        aria-hidden
      />
      <span
        className="relative font-display text-xl leading-tight [text-shadow:3px_3px_0_#000] sm:text-2xl"
        style={{ color: b }}
      >
        {show.title}
      </span>
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 font-mono text-lg text-white">{show.year}</span>
    </div>
  );
}
