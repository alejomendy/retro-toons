"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { channelById, channelNumber, channels } from "@/data/channels";
import PageHeader from "@/components/PageHeader";
import TvPlayer, { NoSignal } from "@/components/TvPlayer";
import VideoPlayer from "@/components/VideoPlayer";
import { formatTime, minutesNow } from "@/lib/schedule";
import { episodeLabel, lcErrorMessages, seriesHref, watchHref, type LcErrorCode, type LcSlot } from "@/lib/lacartoons-types";
import type { ChannelId } from "@/lib/types";

type Grid = { key: string; slots: LcSlot[] } | { key: string; error: string };

export default function ProgramacionClient({ channelId }: { channelId: ChannelId }) {
  const channel = channelById[channelId];
  // La hora se calcula en el cliente para usar la zona horaria del visitante.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const dateKey = now?.toDateString();
  const scheduleKey = `${channelId}|${dateKey}`;
  const [grid, setGrid] = useState<Grid | null>(null);
  const [retry, setRetry] = useState(0);

  // La grilla la arma el servidor con series y episodios reales de LACartoons.
  useEffect(() => {
    if (!now) return;
    const controller = new AbortController();
    fetch(`/api/programacion?canal=${channelId}&fecha=${toDateParam(now)}`, { signal: controller.signal })
      .then(async (r) => {
        const data: unknown = await r.json().catch(() => null);
        const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
        if (r.ok && body.success === true && Array.isArray(body.slots)) {
          setGrid({ key: scheduleKey, slots: body.slots as LcSlot[] });
        } else {
          const code = typeof body.code === "string" ? (body.code as LcErrorCode) : "ADDON_BAD_RESPONSE";
          setGrid({ key: scheduleKey, error: typeof body.error === "string" ? body.error : lcErrorMessages[code] });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setGrid({ key: scheduleKey, error: lcErrorMessages.ADDON_UNREACHABLE });
      });
    return () => controller.abort();
  }, [scheduleKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = grid?.key === scheduleKey ? grid : null;
  const slots = loaded && "slots" in loaded ? loaded.slots : [];
  const error = loaded && "error" in loaded ? loaded.error : null;
  const nowMin = now ? minutesNow(now) : 0;
  const current = now ? slots.find((s) => nowMin >= s.start && nowMin < s.end) : undefined;
  const currentIndex = current ? slots.indexOf(current) : -1;
  const upcoming = current ? slots.slice(currentIndex + 1, currentIndex + 4) : [];
  // El modo cine se guarda acá para que no se apague cuando cambia el programa.
  const [cinema, setCinema] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader kicker={`Estás viendo · CH ${channelNumber(channelId)}`} title="Programación del día" kickerColor={channel.color} kickerInk={channel.ink}>
        Elegí un canal y sintonizá lo que está pasando ahora, como en la tele de antes. Todo en español latino.
      </PageHeader>

      <ChannelTabs active={channelId} />

      <ChannelBanner channelId={channelId} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-4">
          {current && now ? (
            <LiveTv slot={current} now={now} next={upcoming[0]} channelId={channelId} cinema={cinema} onCinemaChange={setCinema} />
          ) : (
            <TvPlayer
              title={error ? "Sin señal" : "Sintonizando..."}
              subtitle={channel.name}
              overlay={error ? <NoSignal title="Sin señal" subtitle={error} hint={null} /> : <Tuning channelName={channel.name} />}
              channel={tvChannel(channelId)}
              cinema={cinema}
              onCinemaChange={setCinema}
            />
          )}
          {error && (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="chunky rounded-lg bg-accent px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              Volver a sintonizar
            </button>
          )}
          {current && now && <NowNext current={current} upcoming={upcoming} now={now} />}
        </section>

        <ScheduleList slots={slots} current={current} now={now} loading={!loaded} />
      </div>
    </div>
  );
}

/** Pantalla mientras llega la grilla (no es "sin señal": todavía no sabemos qué pasa). */
function Tuning({ channelName }: { channelName: string }) {
  return (
    <div className="absolute inset-0">
      <div className="static-noise absolute inset-0 opacity-60" />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="rounded-lg bg-black/75 px-6 py-4">
          <p className="font-display text-xl text-white sm:text-3xl">Sintonizando…</p>
          <p className="font-mono text-xl text-accent sm:text-2xl">{channelName}</p>
        </div>
      </div>
    </div>
  );
}

/** Lo que está al aire (con su avance) y lo que viene. */
function NowNext({ current, upcoming, now }: { current: LcSlot; upcoming: LcSlot[]; now: Date }) {
  const progress = Math.min(1, Math.max(0, (minutesNow(now) - current.start) / (current.end - current.start)));
  return (
    <div className="chunky grid gap-4 rounded-xl bg-panel p-4 sm:grid-cols-[1fr_1fr]">
      <div className="flex min-w-0 gap-3">
        {current.series.poster && (
          <Image src={current.series.poster} alt="" width={64} height={96} className="h-24 w-16 shrink-0 rounded-md border-2 border-black object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-lg text-red-400">AHORA · {formatTime(current.start)}</p>
          {current.external ? (
            <p className="truncate font-display text-lg text-white">{current.series.name}</p>
          ) : (
            <Link href={seriesHref(current.series.id)} className="block truncate font-display text-lg text-white hover:text-accent">
              {current.series.name}
            </Link>
          )}
          <p className="truncate text-sm text-white/70">
            {episodeLabel(current.episode)} · {current.episode.title}
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-black/50"
            role="progressbar"
            aria-label="Avance del espacio"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
          {current.external ? (
            current.external.url && (
              <a href={current.external.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                <Play className="size-3 fill-current" /> Verlo desde el principio en {current.external.via} ↗
              </a>
            )
          ) : (
            <Link
              href={watchHref(current.series.id, current.episode.id)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
            >
              <Play className="size-3 fill-current" /> Verlo desde el principio en la biblioteca
            </Link>
          )}
        </div>
      </div>
      {upcoming.length > 0 && (
        <div className="min-w-0">
          <p className="font-mono text-lg text-white/60">A CONTINUACIÓN</p>
          <ul className="space-y-1">
            {upcoming.map((s) => (
              <li key={s.start} className="flex gap-2 text-sm">
                <span className="w-12 shrink-0 font-mono text-lg leading-tight text-accent">{formatTime(s.start)}</span>
                <span className="min-w-0 truncate text-white/80">
                  <strong className="text-white">{s.series.name}</strong> · {s.episode.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChannelTabs({ active }: { active: ChannelId }) {
  return (
    <div className="flex flex-wrap gap-3" role="tablist" aria-label="Canales">
      {channels.map((c) => {
        const selected = c.id === active;
        return (
          <Link
            key={c.id}
            href={`/programacion?canal=${c.id}`}
            role="tab"
            aria-selected={selected}
            scroll={false}
            className={`chunky rounded-lg px-4 py-2 font-display text-sm transition-transform sm:text-base ${selected ? "-translate-y-1 ring-4 ring-accent" : "opacity-80 hover:opacity-100"}`}
            style={{ backgroundColor: c.color, color: c.ink }}
          >
            <span className="mr-1.5 font-mono text-lg opacity-80">{channelNumber(c.id)}</span>
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}

function tvChannel(id: ChannelId) {
  const c = channelById[id];
  return { number: channelNumber(id), name: c.name, color: c.color, ink: c.ink };
}

/** Franja con la identidad del canal sintonizado: número, nombre, eslogan y época. */
function ChannelBanner({ channelId }: { channelId: ChannelId }) {
  const c = channelById[channelId];
  return (
    <div className="chunky flex flex-wrap items-center gap-x-5 gap-y-2 overflow-hidden rounded-xl px-4 py-3" style={{ backgroundColor: c.color, color: c.ink }}>
      <span className="osd font-mono text-5xl leading-none">CH {channelNumber(channelId)}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl leading-tight">{c.name}</p>
        <p className="font-mono text-xl leading-tight opacity-85">
          {c.tagline} · {c.years}
        </p>
      </div>
      <p className="w-full text-sm opacity-90 sm:w-auto sm:max-w-sm">{c.description}</p>
    </div>
  );
}

function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * La tele en vivo: reproduce el episodio del espacio actual desde el minuto que corresponde.
 * El reproductor es uno solo para todo el día; al cambiar de espacio cambia el episodio.
 * Si el episodio termina antes que el espacio, pasa la tanda hasta el siguiente.
 */
function LiveTv({
  slot,
  now,
  next,
  channelId,
  cinema,
  onCinemaChange,
}: {
  slot: LcSlot;
  now: Date;
  next?: LcSlot;
  channelId: ChannelId;
  cinema: boolean;
  onCinemaChange: (cinema: boolean) => void;
}) {
  const channel = channelById[channelId];
  const slotKey = `${channelId}-${slot.start}`;
  // El punto de arranque se fija al sintonizar el espacio; después el video corre solo.
  const [tuned, setTuned] = useState({ key: slotKey, startAt: (minutesNow(now) - slot.start) * 60 });
  const [endedKey, setEndedKey] = useState<string | null>(null);
  if (tuned.key !== slotKey) {
    setTuned({ key: slotKey, startAt: (minutesNow(now) - slot.start) * 60 });
  }
  const handleEnded = useCallback(() => setEndedKey(slotKey), [slotKey]);
  // Fuentes externas (iframe de YouTube, Pluto TV): no avisan cuándo terminan, se usa la duración del episodio.
  const externalOver = !!slot.external && (minutesNow(now) - slot.start) >= slot.external.minutes;
  const inBreak = endedKey === slotKey || externalOver;
  const bumper = <Bumper channelName={channel.name} color={channel.color} ink={channel.ink} next={next} />;

  if (slot.external) {
    return (
      <TvPlayer
        key={slotKey}
        source={slot.external.source}
        startAt={tuned.startAt}
        title={slot.series.name}
        subtitle={`${episodeLabel(slot.episode)} · ${slot.episode.title} · ${slot.block}`}
        badge={inBreak ? "TANDA" : "EN VIVO"}
        badgeColor={inBreak ? "#7c3aed" : "#ef4444"}
        overlay={inBreak ? bumper : undefined}
        fallback={slot.external.url ? { label: `Verlo en ${slot.external.via}`, url: slot.external.url } : undefined}
        cinema={cinema}
        onCinemaChange={onCinemaChange}
        channel={tvChannel(channelId)}
      />
    );
  }

  return (
    <TvPlayer
      title={slot.series.name}
      subtitle={`${episodeLabel(slot.episode)} · ${slot.episode.title} · ${slot.block}`}
      badge={inBreak ? "TANDA" : "EN VIVO"}
      badgeColor={inBreak ? "#7c3aed" : "#ef4444"}
      overlay={
        <>
          <VideoPlayer episodeId={slot.episode.id} startAt={tuned.startAt} autoPlay live onEnded={handleEnded} />
          {inBreak && <div className="absolute inset-0 z-20">{bumper}</div>}
        </>
      }
      cinema={cinema}
      onCinemaChange={onCinemaChange}
      channel={tvChannel(channelId)}
    />
  );
}

function Bumper({ channelName, color, ink, next }: { channelName: string; color: string; ink: string; next?: LcSlot }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center" style={{ backgroundColor: color, color: ink }}>
      <div>
        <p className="font-mono text-2xl opacity-80">Estás viendo {channelName}</p>
        <p className="font-display text-3xl sm:text-5xl">¡Ya volvemos!</p>
        {next && (
          <p className="mt-3 font-mono text-2xl">
            A continuación: <strong>{next.series.name}</strong> · {formatTime(next.start)}
          </p>
        )}
      </div>
    </div>
  );
}

function ScheduleList({ slots, current, now, loading }: { slots: LcSlot[]; current?: LcSlot; now: Date | null; loading: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentStart = current?.start;

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-current='true']");
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop - 80;
  }, [currentStart, slots]);

  const nowMin = now ? minutesNow(now) : 0;

  return (
    <aside className="chunky flex max-h-[640px] flex-col overflow-hidden rounded-xl bg-panel">
      <div className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-2">
        <h2 className="font-display text-lg text-accent">Grilla de hoy</h2>
        <span className="font-mono text-xl text-white">{now ? now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }) : "--"}</span>
      </div>
      <ol ref={listRef} className="relative flex-1 overflow-y-auto">
        {loading &&
          Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex gap-3 px-4 py-2.5" aria-hidden>
              <span className="h-6 w-14 animate-pulse rounded bg-white/10" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-4 w-2/3 animate-pulse rounded bg-white/15" />
                <span className="block h-3 w-1/2 animate-pulse rounded bg-white/10" />
              </span>
            </li>
          ))}
        {slots.map((s, i) => {
          const isCurrent = s === current;
          const past = s.end <= nowMin;
          const newBlock = i === 0 || slots[i - 1].block !== s.block;
          return (
            <li key={s.start} data-current={isCurrent}>
              {newBlock && (
                <p className="sticky top-0 z-10 border-y-2 border-black bg-accent px-4 py-1 font-display text-xs uppercase text-black">{s.block}</p>
              )}
              <SlotLink
                slot={s}
                className={`flex gap-3 px-4 py-2.5 transition-colors hover:bg-white/10 ${isCurrent ? "bg-[#ff3ea5]/30" : ""} ${past ? "opacity-45" : ""}`}
              >
                <span className="w-14 shrink-0 font-mono text-2xl leading-none text-accent">{formatTime(s.start)}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-bold">{s.series.name}</span>
                    {s.external && (
                      <span className="shrink-0 rounded bg-white px-1 font-mono text-xs text-black" title={`Episodio de ${s.external.via}`}>
                        {s.external.source?.type === "hls" ? "PLUTO" : "YT"}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-white/60">
                    {episodeLabel(s.episode)} · {s.episode.title}
                  </span>
                </span>
                {isCurrent && <span className="blink ml-auto shrink-0 self-center whitespace-nowrap rounded bg-red-500 px-1.5 font-mono text-lg text-white">AL AIRE</span>}
              </SlotLink>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** Lleva al episodio: en la biblioteca si es de LACartoons, o a su fuente original si es externo. */
function SlotLink({ slot, className, children }: { slot: LcSlot; className: string; children: React.ReactNode }) {
  if (!slot.external) {
    return (
      <Link href={watchHref(slot.series.id, slot.episode.id)} className={className}>
        {children}
      </Link>
    );
  }
  if (!slot.external.url) return <div className={className}>{children}</div>;
  return (
    <a href={slot.external.url} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}
