import type { Metadata } from "next";
import { Bungee, Nunito, VT323 } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const display = Bungee({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });
const mono = VT323({ variable: "--font-mono", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RetroToons — Los dibujos de los 90s y 2000s",
  description:
    "Programación del día como en la tele de antes y una biblioteca de cartoons de Cartoon Network, Nickelodeon, Disney XD, Jetix y Fox Kids.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-419">
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans antialiased`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">{children}</main>
        <footer className="border-t-4 border-black bg-black/40 py-6 text-center font-mono text-lg text-white/60">
          RetroToons · Proyecto de fans · Las series y marcas pertenecen a sus respectivos dueños
        </footer>
      </body>
    </html>
  );
}
