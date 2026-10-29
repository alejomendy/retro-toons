import type { Metadata } from "next";
import { Suspense } from "react";
import BibliotecaClient from "./BibliotecaClient";

export const metadata: Metadata = { title: "Biblioteca — RetroToons" };

export default function BibliotecaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent [text-shadow:3px_3px_0_#000] sm:text-4xl">Biblioteca</h1>
        <p className="mt-1 text-white/70">Elegí cualquier serie y mirá el episodio que quieras, cuando quieras.</p>
      </div>
      <Suspense>
        <BibliotecaClient />
      </Suspense>
    </div>
  );
}
