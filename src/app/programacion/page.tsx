import type { Metadata } from "next";
import { isChannelId } from "@/data/channels";
import { OnAirProvider } from "@/lib/use-on-air";
import ProgramacionClient from "./ProgramacionClient";

export const metadata: Metadata = { title: "Programación del día — RetroToons" };

export default async function ProgramacionPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const { canal } = await searchParams;
  // OnAirProvider: lo que pasan los otros canales, para la tanda y el control remoto.
  return (
    <OnAirProvider>
      <ProgramacionClient channelId={isChannelId(canal) ? canal : "cartoon-network"} />
    </OnAirProvider>
  );
}
