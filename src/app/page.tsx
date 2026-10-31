import Link from "next/link";
import { CalendarClock, Library } from "lucide-react";
import { channels } from "@/data/channels";
import { getGenres } from "@/lib/lacartoons-schedule";
import { OnAirProvider } from "@/lib/use-on-air";
import ContinueWatching from "@/components/series/ContinueWatching";
import HalloweenSpecials from "@/components/series/HalloweenSpecials";
import SurpriseButton from "@/components/series/SurpriseButton";
import { SectionTitle } from "@/components/PageHeader";
import { GENRE_LOGOS, GenreLogo } from "@/components/ChannelBrand";
import { HeroTv, OnAirChannels, OnAirTicker } from "./HomeLive";

// Página estática que se renueva cada hora: la CDN la sirve al instante (lo que está al aire se carga en el navegador).
export const revalidate = 3600;

/** Colores de marca para las cadenas que coinciden con un canal. */
const brandByGenre = new Map(channels.map((c) => [c.name, { bg: c.color, ink: c.ink }]));

export default async function Home() {
  // Cadenas reales del catálogo (si el addon no responde, la sección no se muestra).
  const genres = await getGenres().catch((): string[] => []);

  return (
    <OnAirProvider>
      <div className="space-y-14">
        <section className="grid items-center gap-10 pt-2 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <span className="sticker inline-block rounded-md bg-[#ff3ea5] px-2.5 py-0.5 font-mono text-xl uppercase text-white">
              La tele de la tarde · 90s y 2000s
            </span>
            <h1 className="font-display text-5xl leading-[0.95] text-accent [text-shadow:5px_5px_0_#000] sm:text-7xl">
              Volvé a la tarde después del cole
            </h1>
            <p className="max-w-xl text-lg text-white/80 sm:text-xl">
              Prendé la tele: {channels.length} canales con su programación del día, como en los 2000. O elegí cualquier serie de la
              biblioteca y mirala cuando quieras. Todo en español latino.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/programacion"
                className="chunky inline-flex items-center gap-2 rounded-xl bg-[#ff3ea5] px-6 py-3.5 font-display text-lg text-white transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
              >
                <CalendarClock className="size-5" /> Ver qué pasan ahora
              </Link>
              <Link
                href="/biblioteca"
                className="chunky inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-display text-lg text-black transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              >
                <Library className="size-5" /> Ir a la biblioteca
              </Link>
              <SurpriseButton className="px-6 py-3.5 text-lg" />
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xl text-white/65">
              <li>★ {channels.length} canales en vivo</li>
              <li>★ Grilla de 24 hs</li>
              <li>★ Español latino</li>
            </ul>
          </div>
          <HeroTv />
        </section>

        <OnAirTicker />

        <HalloweenSpecials />

        <ContinueWatching />

        <section className="space-y-5" aria-labelledby="canales">
          <SectionTitle
            id="canales"
            aside={
              <Link href="/programacion" className="font-bold text-accent hover:underline">
                Ver la grilla completa →
              </Link>
            }
          >
            Canales en vivo
          </SectionTitle>
          <OnAirChannels />
        </section>

        {genres.length > 0 && (
          <section className="space-y-5" aria-labelledby="cadenas">
            <SectionTitle
              id="cadenas"
              aside={
                <Link href="/biblioteca" className="font-bold text-accent hover:underline">
                  Ver toda la biblioteca →
                </Link>
              }
            >
              Explorá la biblioteca
            </SectionTitle>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {genres.map((g, i) => {
                const brand = brandByGenre.get(g);
                const logo = !!GENRE_LOGOS[g];
                return (
                  <li key={g}>
                    <Link
                      href={`/biblioteca?cadena=${encodeURIComponent(g)}`}
                      className={`chunky flex h-full min-h-20 items-end rounded-xl p-4 font-display text-lg leading-tight transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${
                        i % 2 ? "hover:rotate-1" : "hover:-rotate-1"
                      }`}
                      style={logo ? { backgroundColor: "#fff", color: "#000", borderBottom: `6px solid ${brand?.bg ?? "#000"}` } : { backgroundColor: brand?.bg ?? "#2a1a4d", color: brand?.ink ?? "#fdf6e3" }}
                      aria-label={logo ? g : undefined}
                    >
                      {logo ? (
                        <span className="grid w-full place-items-center">
                          <GenreLogo genre={g} height={30} />
                        </span>
                      ) : (
                        g
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </OnAirProvider>
  );
}
