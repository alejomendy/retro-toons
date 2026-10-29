import Link from "next/link";
import { CalendarClock, Library } from "lucide-react";
import { channels } from "@/data/channels";
import { shows } from "@/data/shows";
import { NoSignal } from "@/components/TvPlayer";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <h1 className="font-display text-4xl leading-tight text-accent [text-shadow:4px_4px_0_#000] sm:text-6xl">
            Volvé a la tarde después del cole
          </h1>
          <p className="text-lg text-white/80">
            Los dibujos de los 90s y 2000s de Cartoon Network, Nickelodeon, Disney XD, Jetix y Fox Kids. Sintonizá un canal
            con su programación del día o elegí qué ver en la biblioteca.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/programacion" className="chunky inline-flex items-center gap-2 rounded-xl bg-[#ff3ea5] px-5 py-3 font-display text-white transition-transform hover:-translate-y-1">
              <CalendarClock className="size-5" /> Ver qué pasan ahora
            </Link>
            <Link href="/biblioteca" className="chunky inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-display text-black transition-transform hover:-translate-y-1">
              <Library className="size-5" /> Ir a la biblioteca
            </Link>
          </div>
        </div>
        <div className="chunky rounded-[2rem] bg-[#3a2a1a] p-5">
          <div className="scanlines relative aspect-video overflow-hidden rounded-[1.5rem] bg-black">
            <NoSignal title="RetroToons" subtitle={`${shows.length} series · ${channels.length} canales`} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-white">Canales</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                href={`/programacion?canal=${c.id}`}
                className="chunky flex h-full flex-col gap-2 rounded-xl p-4 transition-transform hover:-translate-y-1"
                style={{ backgroundColor: c.color, color: c.ink }}
              >
                <span className="font-display text-lg leading-tight">{c.name}</span>
                <span className="font-mono text-lg opacity-80">{c.years}</span>
                <span className="text-sm opacity-90">{c.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
