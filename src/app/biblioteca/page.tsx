import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchGenres } from "@/lib/lacartoons";
import ContinueWatching from "@/components/series/ContinueWatching";
import PageHeader, { SectionTitle } from "@/components/PageHeader";
import BibliotecaClient from "./BibliotecaClient";

export const metadata: Metadata = { title: "Biblioteca — RetroToons" };
export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  // Cadenas reales declaradas por el addon (si no responde, no se muestran esos filtros).
  const genres = await fetchGenres();
  return (
    <div className="space-y-12">
      <PageHeader kicker="A demanda · como en el videoclub" title="Biblioteca" kickerColor="#ffd400" kickerInk="#000000">
        Elegí cualquier serie y mirá el episodio que quieras, cuando quieras. Todo en español latino.
      </PageHeader>
      <ContinueWatching />
      <section className="space-y-5" aria-labelledby="todas-las-series">
        <SectionTitle id="todas-las-series">Todas las series</SectionTitle>
        <Suspense>
          <BibliotecaClient genres={genres} />
        </Suspense>
      </section>
    </div>
  );
}
