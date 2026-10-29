"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { channelNumber } from "@/data/channels";
import { formatTime } from "@/lib/schedule";
import { episodeLabel } from "@/lib/lacartoons-types";
import { useOnAir, type OnAir } from "@/lib/use-on-air";
import { getLastChannel } from "@/lib/user-library";

/** Cada cuánto la tele del inicio cambia sola de canal (hasta que el usuario elige uno). */
const ZAP_MS = 7000;

/** La tele del inicio: muestra lo que está al aire y hace zapping entre canales. */
export function HeroTv() {
  const onAir = useOnAir();
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  // La tele del inicio se prende en el último canal que miraste.
  useEffect(() => {
    const last = getLastChannel();
    const i = onAir.findIndex((o) => o.channel.id === last);
    if (i >= 0) setIndex(i);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (manual) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % onAir.length), ZAP_MS);
    return () => clearInterval(id);
  }, [manual, onAir.length]);

  const item = onAir[index];
  const { channel, current } = item;
  const number = channelNumber(channel.id);

  return (
    <div className="space-y-4">
      <div className="chunky rotate-1 rounded-[2rem] bg-[#3a2a1a] p-4 transition-transform hover:rotate-0 sm:p-5">
        <Link
          href={`/programacion?canal=${channel.id}`}
          aria-label={`Sintonizar ${channel.name}${current ? `: ahora ${current.series.name}` : ""}`}
          className="scanlines group relative block aspect-video overflow-hidden rounded-[1.5rem] bg-black shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
        >
          <Screen item={item} />
          {/* Al cambiar de canal, el número aparece arriba como en la tele de tubo */}
          <span key={channel.id} className="osd osd-flash absolute right-4 top-3 z-10 font-mono text-4xl sm:text-5xl">
            CH {number}
          </span>
          <span className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded bg-red-500 px-2 py-0.5 font-mono text-xl text-white">
            <span className="blink size-2.5 rounded-full bg-white" /> EN VIVO
          </span>
          <span
            className="absolute bottom-3 right-3 z-10 rounded border-2 border-black px-2 font-display text-xs opacity-90 sm:text-sm"
            style={{ backgroundColor: channel.color, color: channel.ink }}
          >
            {channel.name}
          </span>
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-white">{current?.series.name ?? channel.name}</p>
            <p className="truncate font-mono text-xl text-white/70">
              {current ? `${episodeLabel(current.episode)} · ${current.episode.title}` : channel.tagline}
            </p>
          </div>
          <span className="hidden shrink-0 gap-2 sm:flex" aria-hidden>
            <span className="size-6 rounded-full border-2 border-black bg-[#c9a36b]" />
            <span className="size-6 rounded-full border-2 border-black bg-[#c9a36b]" />
          </span>
        </div>
      </div>

      {/* Botonera de canales: elegir uno corta el zapping automático */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Cambiar de canal">
        {onAir.map(({ channel: c }, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setManual(true);
            }}
            aria-pressed={i === index}
            title={c.name}
            className={`chunky flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xl transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${
              i === index ? "-translate-y-1 ring-4 ring-accent" : "opacity-75 hover:opacity-100"
            }`}
            style={{ backgroundColor: c.color, color: c.ink }}
          >
            {channelNumber(c.id)}
            <span className="hidden font-display text-xs sm:inline">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Screen({ item }: { item: OnAir }) {
  const { channel, current, status } = item;
  if (status === "ready" && current?.series.poster) {
    return (
      <>
        <Image src={current.series.poster} alt="" fill sizes="600px" className="scale-110 object-cover opacity-40 blur-md" />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Image
            src={current.series.poster}
            alt={`Póster de ${current.series.name}`}
            width={200}
            height={300}
            className="h-[80%] w-auto rounded-lg border-4 border-black object-cover shadow-[6px_6px_0_#000] transition-transform group-hover:scale-105"
          />
        </div>
      </>
    );
  }
  return (
    <>
      <div className="static-noise absolute inset-0 opacity-60" />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="rounded-lg bg-black/75 px-6 py-4">
          <p className="font-display text-xl text-white sm:text-3xl">{status === "error" ? "Sin señal" : "Sintonizando…"}</p>
          <p className="font-mono text-xl" style={{ color: channel.color === "#111111" ? "#ffd400" : channel.color }}>
            {channel.name}
          </p>
        </div>
      </div>
    </>
  );
}

/** Cinta tipo noticiero con lo que pasa en todos los canales. */
export function OnAirTicker() {
  const onAir = useOnAir().filter((o) => o.current);
  if (onAir.length === 0) return null;
  // La cinta se repite dos veces para que el desplazamiento no tenga corte.
  const items = (copy: string) =>
    onAir.map(({ channel, current }) => (
    <span key={`${copy}-${channel.id}`} className="mx-6 inline-flex items-center gap-2" aria-hidden={copy === "b" || undefined}>
      <span className="rounded border-2 border-black px-1.5 font-display text-xs" style={{ backgroundColor: channel.color, color: channel.ink }}>
        {channel.name}
      </span>
      <span className="font-bold">{current!.series.name}</span>
      <span className="text-black/60">· {current!.episode.title}</span>
    </span>
    ));
  return (
    <div className="chunky flex items-stretch overflow-hidden rounded-xl bg-white text-black" aria-label="Ahora en la tele">
      <span className="z-10 flex shrink-0 items-center gap-2 border-r-4 border-black bg-red-500 px-3 font-display text-sm text-white">
        <span className="blink size-2 rounded-full bg-white" /> AHORA
      </span>
      <div className="min-w-0 flex-1 overflow-hidden py-2">
        <div className="marquee flex w-max whitespace-nowrap">
          {items("a")}
          {items("b")}
        </div>
      </div>
    </div>
  );
}

/** Grilla de canales con lo que está al aire y lo que viene. */
export function OnAirChannels() {
  const onAir = useOnAir();
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {onAir.map(({ channel, current, next, status }) => (
        <li key={channel.id}>
          <Link
            href={`/programacion?canal=${channel.id}`}
            className="chunky group flex h-full flex-col overflow-hidden rounded-xl bg-panel transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
          >
            <div className="flex items-center justify-between gap-2 border-b-4 border-black px-4 py-2" style={{ backgroundColor: channel.color, color: channel.ink }}>
              <span className="font-display text-lg leading-tight">{channel.name}</span>
              <span className="font-mono text-2xl leading-none opacity-90">CH {channelNumber(channel.id)}</span>
            </div>
            <div className="flex flex-1 gap-3 p-3">
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border-2 border-black bg-black/50">
                {current?.series.poster ? (
                  <Image src={current.series.poster} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="static-noise absolute inset-0 opacity-50" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {status === "loading" ? (
                  <p className="flex items-center gap-2 font-mono text-lg text-white/65">
                    <Loader2 className="size-4 animate-spin" /> Sintonizando…
                  </p>
                ) : status === "error" || !current ? (
                  <p className="font-mono text-lg text-white/65">Sin señal por ahora</p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 font-mono text-lg leading-none text-red-400">
                      <span className="blink size-2 rounded-full bg-red-500" /> AHORA · {formatTime(current.start)}
                    </p>
                    <p className="line-clamp-2 font-bold leading-tight text-white">{current.series.name}</p>
                    <p className="truncate text-sm text-white/65">{current.episode.title}</p>
                    {next && (
                      <p className="truncate pt-1 text-xs text-white/65">
                        <span className="font-mono text-base text-accent">{formatTime(next.start)}</span> {next.series.name}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <span className="flex items-center justify-end gap-1 border-t-2 border-black/40 px-4 py-1.5 text-sm font-bold text-accent">
              Sintonizar <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
