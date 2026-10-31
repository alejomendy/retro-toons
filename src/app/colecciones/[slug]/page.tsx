import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAddonCollection } from "@/lib/stremio/addons";
import { getCollectionTitles } from "@/lib/stremio/client";
import PageHeader from "@/components/PageHeader";
import { SeriesGrid } from "@/components/series/SeriesCard";
import AddonTitleCard from "@/components/series/AddonTitleCard";
import StateMessage from "@/components/series/StateMessage";

type Params = Promise<{ slug: string }>;

export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const collection = getAddonCollection((await params).slug);
  return { title: `${collection?.title ?? "Colección"} — RetroToons` };
}

export default async function ColeccionPage({ params }: { params: Params }) {
  const collection = getAddonCollection((await params).slug);
  if (!collection) notFound();
  const titles = await getCollectionTitles(collection.slug).catch(() => null);
  const playable = titles?.filter((t) => t.lacartoons).length ?? 0;

  return (
    <div className="space-y-8">
      <Link href="/biblioteca" className="inline-flex items-center gap-1 font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent">
        <ArrowLeft className="size-4" /> Volver a la biblioteca
      </Link>
      <PageHeader kicker="Colección · addons de Stremio" title={collection.title} kickerColor="#ffd400" kickerInk="#000000">
        {collection.description}
      </PageHeader>
      {!titles ? (
        <StateMessage tone="error" title="No pudimos cargar la colección" action={{ href: "/biblioteca", label: "Volver a la biblioteca" }}>
          Los addons no respondieron. Probá de nuevo en un rato.
        </StateMessage>
      ) : (
        <>
          <p className="font-mono text-xl text-white/65">
            {titles.length} títulos{playable > 0 && ` · ${playable} para ver en RetroToons`}
          </p>
          <SeriesGrid>
            {titles.map((t) => (
              <li key={`${t.type}:${t.id}`}>
                <AddonTitleCard title={t} />
              </li>
            ))}
          </SeriesGrid>
        </>
      )}
    </div>
  );
}
