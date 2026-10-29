import type { Metadata } from "next";
import { Bungee, Nunito, VT323 } from "next/font/google";
import Header from "@/components/Header";
import AchievementToast from "@/components/AchievementToast";
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
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-bold focus:text-black"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 focus:outline-none">
          {children}
        </main>
        <AchievementToast />
        <footer className="border-t-4 border-black bg-black/40 py-6 text-center font-mono text-lg text-white/65">
          RetroToons · Proyecto de fans · Las series y marcas pertenecen a sus respectivos dueños
        </footer>
      </body>
    </html>
  );
}
