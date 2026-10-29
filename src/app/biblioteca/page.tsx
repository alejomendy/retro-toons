import type { Metadata } from "next";
import { Suspense } from "react";
import { shows } from "@/data/shows";
import { getPosters } from "@/lib/catalog";
import BibliotecaClient from "./BibliotecaClient";

export const metadata: Metadata = { title: "Biblioteca — RetroToons" };
// Los pósters se refrescan una vez por día.
export const revalidate = 86400;

export default async function BibliotecaPage() {
  const posters = await getPosters(shows);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent [text-shadow:3px_3px_0_#000] sm:text-4xl">Biblioteca</h1>
        <p className="mt-1 text-white/70">Elegí cualquier serie y mirá el episodio que quieras, cuando quieras.</p>
      </div>
      <Suspense>
        <BibliotecaClient posters={posters} />
      </Suspense>
    </div>
  );
}
