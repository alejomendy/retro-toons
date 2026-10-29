"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { channelById, channels } from "@/data/channels";
import TvPlayer from "@/components/TvPlayer";
import { findCurrentSlot, formatTime, getDaySchedule, minutesNow } from "@/lib/schedule";
import type { ChannelId, Slot, VideoSource } from "@/lib/types";

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
  // Grilla local al instante; se reemplaza por la de /api/programacion (con títulos de TVmaze) cuando llega.
  const localSlots = useMemo(() => (now ? getDaySchedule(channelId, now) : []), [channelId, dateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [remote, setRemote] = useState<{ key: string; slots: Slot[] } | null>(null);
  const scheduleKey = `${channelId}|${dateKey}`;

  useEffect(() => {
    if (!now) return;
    let cancelled = false;
    fetch(`/api/programacion?canal=${channelId}&fecha=${toDateParam(now)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { slots: Slot[] } | null) => {
        if (data && !cancelled) setRemote({ key: scheduleKey, slots: data.slots });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scheduleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = remote?.key === scheduleKey ? remote.slots : localSlots;
  const current = now ? findCurrentSlot(slots, now) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-accent [text-shadow:3px_3px_0_#000] sm:text-4xl">Programación del día</h1>
        <p className="mt-1 text-white/70">Elegí un canal y sintonizá lo que está pasando ahora, como en la tele de antes.</p>
      </div>

      <ChannelTabs active={channelId} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {current && now ? (
            <LiveTv key={`${channelId}-${dateKey}-${current.start}`} slot={current} now={now} next={slots[slots.indexOf(current) + 1]} channelId={channelId} />
          ) : (
            <TvPlayer title="Sintonizando..." subtitle={channel.name} />
          )}
          <div className="chunky rounded-xl p-4" style={{ backgroundColor: channel.color, color: channel.ink }}>
            <p className="font-display text-xl">{channel.name}</p>
            <p className="font-mono text-xl opacity-80">{channel.tagline} · {channel.years}</p>
            <p className="mt-1 text-sm opacity-90">{channel.description}</p>
          </div>
        </section>

        <ScheduleList slots={slots} current={current} now={now} />
      </div>
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
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}

function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function LiveTv({ slot, now, next, channelId }: { slot: Slot; now: Date; next?: Slot; channelId: ChannelId }) {
  const channel = channelById[channelId];
  const elapsed = (minutesNow(now) - slot.start) * 60;
  // El punto de arranque se fija cuando aparece la fuente; después el video corre solo.
  const [video, setVideo] = useState<{ source?: VideoSource; startAt: number }>(() => ({ source: slot.episode.source, startAt: elapsed }));

  useEffect(() => {
    if (slot.episode.source) return;
    let cancelled = false;
    const tunedAt = Date.now();
    fetch(`/api/video?serie=${slot.show.id}&ep=${slot.episode.number}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { source: VideoSource | null } | null) => {
        if (cancelled || !data?.source) return;
        setVideo((v) => ({ source: data.source!, startAt: v.startAt + (Date.now() - tunedAt) / 1000 }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slot.show.id, slot.episode.number, slot.episode.source]);

  const episodeSeconds = slot.episode.minutes * 60;
  const inBreak = elapsed >= episodeSeconds;

  return (
    <TvPlayer
      key={video.source ? "on" : "off"}
      source={video.source}
      startAt={video.startAt}
      title={slot.show.title}
      subtitle={`${slot.episode.title} · ${slot.block}`}
      badge={inBreak ? "TANDA" : "EN VIVO"}
      badgeColor={inBreak ? "#7c3aed" : "#ef4444"}
      overlay={inBreak ? <Bumper channelName={channel.name} color={channel.color} ink={channel.ink} next={next} /> : undefined}
    />
  );
}

function Bumper({ channelName, color, ink, next }: { channelName: string; color: string; ink: string; next?: Slot }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center" style={{ backgroundColor: color, color: ink }}>
      <div>
        <p className="font-mono text-2xl opacity-80">Estás viendo {channelName}</p>
        <p className="font-display text-3xl sm:text-5xl">¡Ya volvemos!</p>
        {next && (
          <p className="mt-3 font-mono text-2xl">
            A continuación: <strong>{next.show.title}</strong> · {formatTime(next.start)}
          </p>
        )}
      </div>
    </div>
  );
}

function ScheduleList({ slots, current, now }: { slots: Slot[]; current?: Slot; now: Date | null }) {
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
        {slots.map((s, i) => {
          const isCurrent = s === current;
          const past = s.end <= nowMin;
          const newBlock = i === 0 || slots[i - 1].block !== s.block;
          return (
            <li key={s.start} data-current={isCurrent}>
              {newBlock && (
                <p className="sticky top-0 z-10 border-y-2 border-black bg-accent px-4 py-1 font-display text-xs uppercase text-black">{s.block}</p>
              )}
              <Link
                href={`/biblioteca/${s.show.id}?ep=${s.episode.number}`}
                className={`flex gap-3 px-4 py-2.5 transition-colors hover:bg-white/10 ${isCurrent ? "bg-[#ff3ea5]/30" : ""} ${past ? "opacity-45" : ""}`}
              >
                <span className="w-14 shrink-0 font-mono text-2xl leading-none text-accent">{formatTime(s.start)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{s.show.title}</span>
                  <span className="block text-sm text-white/60">{s.episode.title}</span>
                </span>
                {isCurrent && <span className="blink ml-auto shrink-0 self-center whitespace-nowrap rounded bg-red-500 px-1.5 font-mono text-lg text-white">AL AIRE</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
