import { getExternalSeries } from "@/lib/lacartoons-schedule";
import { SectionTitle } from "@/components/PageHeader";
import SeriesCard, { SeriesCardSkeleton, SeriesGrid } from "@/components/series/SeriesCard";
import FavoriteButton from "@/components/series/FavoriteButton";

/** Clásicos que no están (o no se pueden ver) en LACartoons, desde YouTube oficial y Pluto TV. */
export default async function ExternalSeries() {
  const series = await getExternalSeries().catch(() => []);
  if (series.length === 0) return null;
  return (
    <section className="space-y-5" aria-labelledby="otras-fuentes">
      <SectionTitle id="otras-fuentes">Desde YouTube oficial y Pluto TV</SectionTitle>
      <p className="-mt-2 text-white/70">Clásicos que no están en LACartoons, desde sus canales oficiales o gratis en Pluto TV.</p>
      <SeriesGrid>
        {series.map((s) => (
          <li key={s.id}>
            <SeriesCard
              id={s.id}
              name={s.name}
              poster={s.poster}
              badges={<span className="inline-block rounded border-2 border-black bg-white px-1.5 font-mono text-sm leading-tight text-black">{s.year}</span>}
            >
              <FavoriteButton id={s.id} name={s.name} poster={s.poster} compact />
            </SeriesCard>
          </li>
        ))}
      </SeriesGrid>
    </section>
  );
}

export function ExternalSeriesSkeleton() {
  return (
    <section className="space-y-5" aria-hidden>
      <SectionTitle>Desde YouTube oficial y Pluto TV</SectionTitle>
      <SeriesGrid>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <SeriesCardSkeleton />
          </li>
        ))}
      </SeriesGrid>
    </section>
  );
}
