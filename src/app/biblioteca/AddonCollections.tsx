import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ADDON_COLLECTIONS, type AddonCollection } from "@/lib/stremio/addons";
import { getCollectionTitles } from "@/lib/stremio/client";
import { SectionTitle } from "@/components/PageHeader";
import { SeriesCardSkeleton, SeriesGrid } from "@/components/series/SeriesCard";
import AddonTitleCard from "@/components/series/AddonTitleCard";

/** Títulos de cada colección que se muestran en la biblioteca (el resto, en su página). */
const PREVIEW = 4;

/** Categorías nuevas armadas con los addons de Stremio (Cartoon Network, Springfield 3000, SCPlus). */
export default function AddonCollections() {
  return (
    <>
      {ADDON_COLLECTIONS.map((collection) => (
        <CollectionRow key={collection.slug} collection={collection} />
      ))}
    </>
  );
}

async function CollectionRow({ collection }: { collection: AddonCollection }) {
  const titles = await getCollectionTitles(collection.slug).catch(() => []);
  if (titles.length === 0) return null;
  const href = `/colecciones/${collection.slug}`;
  return (
    <section className="space-y-5" aria-labelledby={`col-${collection.slug}`}>
      <SectionTitle
        id={`col-${collection.slug}`}
        aside={
          <Link href={href} className="chunky inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-black transition-transform hover:-translate-y-0.5">
            Ver las {titles.length} <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {collection.title}
      </SectionTitle>
      <p className="-mt-2 text-white/70">{collection.description}</p>
      <SeriesGrid>
        {/* En la vista previa, primero las que se pueden ver acá. */}
        {[...titles.filter((t) => t.lacartoons), ...titles.filter((t) => !t.lacartoons)].slice(0, PREVIEW).map((t) => (
          <li key={`${t.type}:${t.id}`}>
            <AddonTitleCard title={t} />
          </li>
        ))}
      </SeriesGrid>
    </section>
  );
}

export function AddonCollectionsSkeleton() {
  return (
    <section className="space-y-5" aria-hidden>
      <SectionTitle>Colecciones</SectionTitle>
      <SeriesGrid>
        {Array.from({ length: PREVIEW }, (_, i) => (
          <li key={i}>
            <SeriesCardSkeleton />
          </li>
        ))}
      </SeriesGrid>
    </section>
  );
}
