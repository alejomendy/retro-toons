import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import GuiaClient from "./GuiaClient";

export const metadata: Metadata = { title: "Guía de canales — RetroToons" };

export default function GuiaPage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Todos los canales · como en el cable" title="Guía de canales" kickerColor="#ffd400" kickerInk="#000000">
        Qué pasan en los seis canales, hora por hora, toda la semana.
      </PageHeader>
      <GuiaClient />
    </div>
  );
}
