import type { Metadata } from "next";
import { isChannelId } from "@/data/channels";
import ProgramacionClient from "./ProgramacionClient";

export const metadata: Metadata = { title: "Programación del día — RetroToons" };

export default async function ProgramacionPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const { canal } = await searchParams;
  return <ProgramacionClient channelId={isChannelId(canal) ? canal : "cartoon-network"} />;
}
