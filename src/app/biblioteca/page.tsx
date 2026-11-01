import type { Metadata } from "next";
import { Suspense } from "react";
import { getGenres } from "@/lib/lacartoons-schedule";
import ContinueWatching from "@/components/series/ContinueWatching";
import PageHeader, { SectionTitle } from "@/components/PageHeader";
import BibliotecaClient from "./BibliotecaClient";
import SurpriseButton from "@/components/series/SurpriseButton";
import AchievementsSection from "@/components/series/AchievementsSection";

export const metadata: Metadata = { title: "Biblioteca — RetroToons" };
export const dynamic = "force-dynamic";
// El addon en el plan gratis de Render tarda hasta ~50 s en despertar.
export const maxDuration = 60;

/** Una sola biblioteca: todas las series (LACartoons, YouTube oficial y Pluto TV) con filtros por cadena. */
export default async function BibliotecaPage() {
  // Cadenas reales declaradas por el addon (si no responde, no se muestran esos filtros).
  const genres = await getGenres();
  return (
    <div className="space-y-12">
      <PageHeader kicker="A demanda · como en el videoclub" title="Biblioteca" kickerColor="#ffd400" kickerInk="#000000" aside={<SurpriseButton />}>
        Elegí cualquier serie y mirá el episodio que quieras, cuando quieras. Todo en español latino.
      </PageHeader>
      <ContinueWatching />
      <section className="space-y-5" aria-labelledby="todas-las-series">
        <SectionTitle id="todas-las-series">Todas las series</SectionTitle>
        <Suspense>
          <BibliotecaClient genres={genres} />
        </Suspense>
      </section>
      <AchievementsSection />
    </div>
  );
}
