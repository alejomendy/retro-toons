import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import AddonsClient from "./AddonsClient";

export const metadata: Metadata = { title: "Addons — RetroToons" };

export default function AddonsPage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Catálogos externos · Stremio" title="Explorar addons" kickerColor="#ffd400" kickerInk="#000000">
        Explorá fuentes externas de animación y consultá la disponibilidad real de episodios desde RetroToons.
      </PageHeader>
      <AddonsClient />
    </div>
  );
}
