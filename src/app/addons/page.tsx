import type { Metadata } from "next";
import Link from "next/link";
import PageHeader, { SectionTitle } from "@/components/PageHeader";
import { ADDON_COLLECTIONS } from "@/lib/stremio/addons";
import AddonsClient from "./AddonsClient";

export const metadata: Metadata = { title: "Addons — RetroToons" };

export default function AddonsPage() {
  return (
    <div className="space-y-10">
      <PageHeader kicker="Catálogos externos · Stremio" title="Explorar addons" kickerColor="#ffd400" kickerInk="#000000">
        Los catálogos de Cartoon Network, Springfield 3000, SCPlus y AnimVault, con fichas en español latino. Lo marcado «▶ Para ver» se ve acá mismo.
      </PageHeader>
      <section className="space-y-4" aria-labelledby="colecciones">
        <SectionTitle id="colecciones">Colecciones</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {ADDON_COLLECTIONS.map((c) => (
            <li key={c.slug}>
              <Link href={`/colecciones/${c.slug}`} className="chunky inline-block rounded-lg bg-white px-3 py-1.5 font-bold text-black transition-transform hover:-translate-y-0.5">
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4" aria-labelledby="catalogos">
        <SectionTitle id="catalogos">Todos los catálogos</SectionTitle>
        <AddonsClient />
      </section>
    </div>
  );
}
