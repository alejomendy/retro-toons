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
type Search = Promise<{ ver?: string }>;

export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const collection = getAddonCollection((await params).slug);
  return { title: `${collection?.title ?? "Colección"} — RetroToons` };
}

export default async function ColeccionPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const collection = getAddonCollection((await params).slug);
  if (!collection) notFound();
  const onlyPlayable = (await searchParams).ver === "disponibles";
  const titles = await getCollectionTitles(collection.slug).catch(() => null);
  const playable = titles?.filter((t) => t.lacartoons) ?? [];
  // Lo que se puede ver acá va primero; el resto queda como ficha.
  const shown = onlyPlayable ? playable : [...playable, ...(titles ?? []).filter((t) => !t.lacartoons)];
  const href = `/colecciones/${collection.slug}`;

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
          {playable.length > 0 && (
            <div className="inline-flex rounded-lg border-2 border-black bg-black/40 p-1 text-sm font-bold" role="group" aria-label="Qué mostrar">
              <Link href={href} aria-current={!onlyPlayable ? "true" : undefined} className={`rounded-md px-3 py-1.5 ${!onlyPlayable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}>
                Todo ({titles.length})
              </Link>
              <Link
                href={`${href}?ver=disponibles`}
                aria-current={onlyPlayable ? "true" : undefined}
                className={`rounded-md px-3 py-1.5 ${onlyPlayable ? "bg-accent text-black" : "text-white/70 hover:text-white"}`}
              >
                Para ver ahora ({playable.length})
              </Link>
            </div>
          )}
          {playable.length === 0 && <p className="font-mono text-xl text-white/65">{titles.length} títulos · todavía ninguno para ver en RetroToons</p>}
          <SeriesGrid>
            {shown.map((t) => (
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
