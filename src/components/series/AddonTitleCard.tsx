import SeriesCard from "@/components/series/SeriesCard";
import FavoriteButton from "@/components/series/FavoriteButton";
import { seriesHref } from "@/lib/lacartoons-types";
import { addonTitleHref, type AddonTitle } from "@/lib/stremio/types";

/**
 * Tarjeta de un título de un addon de Stremio. Si la serie está en LACartoons lleva directo a
 * verla; si no, a su ficha.
 */
export default function AddonTitleCard({ title }: { title: AddonTitle }) {
  const lc = title.lacartoons;
  return (
    <SeriesCard
      id={title.id}
      name={title.name}
      poster={title.poster}
      href={lc ? seriesHref(lc.id) : addonTitleHref(title)}
      badges={
        <div className="flex flex-wrap gap-1">
          {lc && <span className="rounded border-2 border-black bg-accent px-1.5 font-mono text-sm leading-tight text-black">▶ Para ver</span>}
          {title.type === "movie" && <span className="rounded border-2 border-black bg-white px-1.5 font-mono text-sm leading-tight text-black">Película</span>}
          {title.year && <span className="rounded border-2 border-black bg-white px-1.5 font-mono text-sm leading-tight text-black">{title.year}</span>}
        </div>
      }
    >
      {lc && <FavoriteButton id={lc.id} name={lc.name} poster={title.poster} compact />}
    </SeriesCard>
  );
}
