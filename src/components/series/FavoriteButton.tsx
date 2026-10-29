"use client";

import { Heart } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/lib/user-library";

export default function FavoriteButton({
  id,
  name,
  poster,
  compact = false,
}: {
  id: string;
  name: string;
  poster: string | null;
  compact?: boolean;
}) {
  const favorites = useFavorites();
  const active = favorites.some((f) => f.id === id);
  const label = active ? `Quitar ${name} de favoritos` : `Agregar ${name} a favoritos`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => toggleFavorite({ id, name, poster })}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full border-2 border-black bg-black/70 text-white transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        <Heart className={`size-4 ${active ? "fill-[#ff3ea5] text-[#ff3ea5]" : ""}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggleFavorite({ id, name, poster })}
      aria-pressed={active}
      aria-label={label}
      className={`chunky inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
        active ? "bg-[#ff3ea5] text-white" : "bg-white text-black"
      }`}
    >
      <Heart className={`size-5 ${active ? "fill-current" : ""}`} />
      {active ? "En favoritos" : "Agregar a favoritos"}
    </button>
  );
}
