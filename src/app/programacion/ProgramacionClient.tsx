"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { channelById, channelNumber, channels } from "@/data/channels";
import PageHeader from "@/components/PageHeader";
import { useTheaterMode } from "@/lib/use-theater";
import { prefetchStreams } from "@/lib/prefetch-streams";
import { forgetGrids, loadGrids, toDateParam } from "@/lib/grids";
import { useOnAir } from "@/lib/use-on-air";
import { getLastChannel, recordChannelVisit, recordFinishedEpisode, setLastChannel } from "@/lib/user-library";
import TvPlayer, { NoSignal } from "@/components/TvPlayer";
import VideoPlayer from "@/components/LazyVideoPlayer";
import { formatTime, minutesNow } from "@/lib/schedule";
import { episodeLabel, lcErrorMessages, seriesHref, watchHref, type LcSlot } from "@/lib/lacartoons-types";
import type { ChannelId } from "@/lib/types";

type Grid = { key: string; slots: LcSlot[] } | { key: string; error: string };

export default function ProgramacionClient({ channelId, explicit }: { channelId: ChannelId; explicit: boolean }) {
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
    // Las seis grillas vienen juntas (y compartidas con el resto de la página): cambiar de canal no espera a nadie.
    let cancelled = false;
    const fecha = toDateParam(now);
    if (retry > 0) forgetGrids(fecha);
    loadGrids(fecha)
      .then((all) => {
        if (cancelled) return;
        const slots = all[channelId];
        setGrid(slots ? { key: scheduleKey, slots } : { key: scheduleKey, error: lcErrorMessages.ADDON_BAD_RESPONSE });
      })
      .catch(() => {
        if (!cancelled) setGrid({ key: scheduleKey, error: lcErrorMessages.ADDON_UNREACHABLE });
      });
    return () => {
      cancelled = true;
    };
  }, [scheduleKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = grid?.key === scheduleKey ? grid : null;
  const slots = loaded && "slots" in loaded ? loaded.slots : [];
  const error = loaded && "error" in loaded ? loaded.error : null;
  const nowMin = now ? minutesNow(now) : 0;
  const current = now ? slots.find((s) => nowMin >= s.start && nowMin < s.end) : undefined;
  const currentIndex = current ? slots.indexOf(current) : -1;
  const upcoming = current ? slots.slice(currentIndex + 1, currentIndex + 4) : [];
  // El reloj general avanza cada 10 s; para cambiar de programa justo a la hora de la grilla
  // se agenda un tic exacto en el fin del espacio actual.
  const currentEnd = current?.end;
  useEffect(() => {
    if (currentEnd === undefined || !now) return;
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime() + currentEnd * 60_000 - Date.now();
    const id = window.setTimeout(() => setNow(new Date()), Math.max(0, ms) + 50);
    return () => window.clearTimeout(id);
  }, [currentEnd, now]);
  // Faltando 5 minutos para el próximo programa, se dejan listas sus fuentes.
  const nextUp = upcoming[0];
  const nextSoon = !!nextUp && !nextUp.external && nextUp.start - nowMin <= 5;
  useEffect(() => {
    if (nextSoon && nextUp) prefetchStreams(nextUp.episode.id);
  }, [nextSoon, nextUp]);
  // El modo cine se guarda acá para que no se apague cuando cambia el programa.
  const [cinema, setCinema] = useTheaterMode();
  const remote = useRemoteControl(channelId);
  const router = useRouter();
  // Modo «tele de verdad»: sin canal en la URL, se prende en el último que miraste.
  useEffect(() => {
    if (explicit) return;
    const last = getLastChannel();
    if (last && last !== channelId && channels.some((c) => c.id === last)) {
      router.replace(`/programacion?canal=${last}`, { scroll: false });
    }
    // Solo al entrar a la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Se recuerda el canal y cuenta para los logros de zapping.
  useEffect(() => {
    setLastChannel(channelId);
    recordChannelVisit(channelId, channels.length);
  }, [channelId]);
  // Con el control remoto lo más probable es ir al canal de al lado: se dejan listas sus fuentes.
  const onAir = useOnAir();
  const neighborIds = (() => {
    const i = channels.findIndex((c) => c.id === channelId);
    return [channels[(i + 1) % channels.length].id, channels[(i - 1 + channels.length) % channels.length].id];
  })();
  const neighborEpisodes = onAir
    .filter((o) => neighborIds.includes(o.channel.id) && o.current && !o.current.external)
    .map((o) => o.current!.episode.id)
    .join(",");
  useEffect(() => {
    if (!neighborEpisodes) return;
    // Un rato después de sintonizar, para no competir con la carga del canal actual.
    const id = window.setTimeout(() => neighborEpisodes.split(",").forEach(prefetchStreams), 8000);
    return () => window.clearTimeout(id);
  }, [neighborEpisodes]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`Estás viendo · CH ${channelNumber(channelId)}`}
        title="Programación del día"
        kickerColor={channel.color}
        kickerInk={channel.ink}
        aside={
          <Link href="/guia" className="font-bold text-accent hover:underline">
            Ver la guía de todos los canales →
          </Link>
        }
      >
        Elegí un canal y sintonizá lo que está pasando ahora, como en la tele de antes. Todo en español latino.
      </PageHeader>

      <ChannelTabs active={channelId} />

      <ChannelBanner channelId={channelId} />
      {/* Para lectores de pantalla: anuncia el canal al cambiar con el control remoto. */}
      <p className="sr-only" aria-live="polite">
        Sintonizaste el canal {channelNumber(channelId)}, {channel.name}.
      </p>

      {/* En modo cine la tele toma todo el ancho y la grilla pasa abajo (mismo árbol: el video no se corta). */}
      <div className={cinema ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1fr_360px]"}>
        <section className="min-w-0 space-y-4">
          {/* Deslizar el dedo sobre la tele cambia de canal, como el control remoto. */}
          <div onTouchStart={remote.onTouchStart} onTouchEnd={remote.onTouchEnd}>
            {current && now ? (
              <LiveTv slot={current} now={now} upcoming={upcoming} channelId={channelId} cinema={cinema} onCinemaChange={setCinema} />
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
          </div>
          <RemoteBar channelId={channelId} onPrev={remote.prev} onNext={remote.next} />
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

        <WeekGuide channelId={channelId} now={now} todaySlots={slots} current={current} loading={!loaded} />
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
          <p className="font-mono text-lg text-white/65">A CONTINUACIÓN</p>
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

/** Segundos transcurridos del espacio, con la hora exacta de ahora (no la del último tic del reloj). */
function secondsIntoSlot(slot: LcSlot): number {
  return Math.max(0, (minutesNow(new Date()) - slot.start) * 60);
}

/** Tope de espera entre un capítulo y otro: pasado esto se saca la placa y se ve el estado real del reproductor. */
const IDENT_MAX_MS = 15_000;
/** Con menos tiempo que esto en el espacio no se arranca otro capítulo de la serie: se adelanta el próximo programa. */
const MIN_FILL_SECONDS = 180;
/** Con tan poco tiempo restante alcanza con una tanda corta hasta el próximo programa. */
const SHORT_BREAK_SECONDS = 15;
/** Un rato después de arrancar el capítulo se dejan listas las fuentes de lo que puede seguir. */
const PREFETCH_NEXT_MS = 30_000;

interface Play {
  /** Espacio al que corresponde (si cambia el espacio, se vuelve a sintonizar). */
  key: string;
  /** 0 = el episodio de la grilla, 1..n = los de reserva (slot.more). */
  pick: number;
  startAt: number;
  /** Clave del próximo espacio si su episodio arrancó antes de hora (al llegar su horario sigue sin cortar). */
  early?: string;
  /** El adelantado no tenía video: al llegar su horario se sintoniza normal. */
  earlyFailed?: boolean;
  /** Viene a continuación de otro capítulo que terminó (no de sintonizar el canal). */
  follows?: boolean;
}

/**
 * La tele en vivo: reproduce el episodio del espacio actual desde el minuto que corresponde.
 * El reproductor es uno solo para todo el día; al cambiar de espacio cambia el episodio.
 * Transiciones como en la tele: placa del canal mientras sintoniza, zócalo "Estás viendo" al arrancar
 * y tanda con cuenta regresiva si el episodio termina antes que su espacio.
 */
function LiveTv({
  slot,
  now,
  upcoming,
  channelId,
  cinema,
  onCinemaChange,
}: {
  slot: LcSlot;
  now: Date;
  upcoming: LcSlot[];
  channelId: ChannelId;
  cinema: boolean;
  onCinemaChange: (cinema: boolean) => void;
}) {
  const channel = channelById[channelId];
  const slotKey = `${channelId}-${slot.start}`;
  // Qué episodio del espacio se está pasando: 0 = el de la grilla, 1..n = los de reserva (slot.more).
  // El punto de arranque se fija al sintonizarlo; después el video corre solo.
  const [play, setPlay] = useState<Play>(() => ({ key: slotKey, pick: 0, startAt: secondsIntoSlot(slot) }));
  const [endedKey, setEndedKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [identExpiredKey, setIdentExpiredKey] = useState<string | null>(null);
  if (play.key !== slotKey) {
    // Si el programa ya venía adelantado, sigue corriendo sin cortar (mismo episodio y mismo punto de arranque).
    const carry = play.early === slotKey && !play.earlyFailed;
    setPlay(carry ? { key: slotKey, pick: 0, startAt: play.startAt, follows: true } : { key: slotKey, pick: 0, startAt: secondsIntoSlot(slot) });
  }
  const reserve = slot.more ?? [];
  const pick = play.key === slotKey ? play.pick : 0;
  // El próximo programa, si empieza justo cuando termina este (para adelantarlo).
  const nextSlot = upcoming[0] && upcoming[0].start === slot.end && !upcoming[0].external ? upcoming[0] : undefined;
  const nextSlotKey = nextSlot ? `${channelId}-${nextSlot.start}` : null;
  const early = play.key === slotKey && !!nextSlot && play.early === nextSlotKey ? nextSlot : undefined;
  const episode = early ? early.episode : pick === 0 ? slot.episode : reserve[pick - 1];
  const showing: LcSlot = { ...(early ?? slot), episode };
  // El adelantado usa la clave que va a tener en su espacio: al llegar su horario no se vuelve a mostrar la placa.
  const playKey = early ? `${nextSlotKey}-0` : `${slotKey}-${pick}`;

  const handlePlaying = useCallback(() => setPlayingKey(playKey), [playKey]);
  // Si el episodio no carga, se pasa otro de la misma serie (sin "Sin señal"): el de la grilla se reemplaza
  // desde el mismo punto del espacio; uno de relleno, desde el principio.
  const handleUnavailable = useCallback(
    (id: string) => {
      if (id !== episode.id) return;
      if (early) {
        setPlay((p) => ({ ...p, earlyFailed: true }));
        setEndedKey(slotKey);
        return;
      }
      if (pick >= reserve.length) return;
      setPlay({ key: slotKey, pick: pick + 1, startAt: play.startAt === 0 && pick > 0 ? 0 : secondsIntoSlot(slot) });
    },
    [episode.id, early, pick, reserve.length, slotKey, slot, play.startAt],
  );
  // Al terminar, nunca una tanda larga: sigue otro capítulo de la serie o se adelanta el próximo programa.
  const handleEnded = useCallback(
    (id: string) => {
      if (id !== episode.id) return;
      recordFinishedEpisode(showing.series.id, showing.series.name);
      const left = (slot.end - minutesNow(new Date())) * 60;
      if (!early && pick < reserve.length && left > MIN_FILL_SECONDS) {
        setPlay({ key: slotKey, pick: pick + 1, startAt: 0, follows: true });
      } else if (!early && nextSlotKey && left > SHORT_BREAK_SECONDS) {
        setPlay({ key: slotKey, pick, startAt: 0, early: nextSlotKey, follows: true });
      } else if (!early && pick < reserve.length && left > SHORT_BREAK_SECONDS) {
        setPlay({ key: slotKey, pick: pick + 1, startAt: 0, follows: true });
      } else {
        setEndedKey(slotKey);
      }
    },
    [episode.id, early, pick, reserve.length, slot.end, showing.series.id, showing.series.name, slotKey, nextSlotKey],
  );

  // Mientras se ve un capítulo se dejan listas las fuentes de lo que puede seguir (el de reserva y el próximo programa).
  const playingNow = playingKey === playKey;
  // Primero el que más seguro sigue (el de reserva): el addon busca de a una.
  const followIds = [!early && pick < reserve.length ? reserve[pick].id : null, nextSlot && !early ? nextSlot.episode.id : null]
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    if (!playingNow || !followIds) return;
    const id = window.setTimeout(() => followIds.split(",").forEach(prefetchStreams), PREFETCH_NEXT_MS);
    return () => window.clearTimeout(id);
  }, [playingNow, followIds]);

  // Fuentes externas (iframe de YouTube, Pluto TV): no avisan cuándo terminan, se usa la duración del episodio.
  const externalOver = !!slot.external && minutesNow(now) - slot.start >= slot.external.minutes;
  const inBreak = endedKey === slotKey || externalOver;

  // La placa del canal tapa la carga del episodio nuevo (o se va sola si tarda demasiado).
  useEffect(() => {
    const id = window.setTimeout(() => setIdentExpiredKey(playKey), IDENT_MAX_MS);
    return () => window.clearTimeout(id);
  }, [playKey]);
  const showIdent = !slot.external && !inBreak && playingKey !== playKey && identExpiredKey !== playKey;
  // Al sintonizar la placa dice "Ahora"; de un capítulo a otro, "A continuación".
  const transition = !!play.follows;
  // El zócalo aparece cuando arranca cada episodio (en los externos, al sintonizar).
  const showLowerThird = !inBreak && (slot.external ? true : playingKey === playKey);

  // Tanda en el medio del episodio (en los cortes que encuentra el reproductor): el video queda en pausa.
  const [tanda, setTanda] = useState<{ key: string; index: number } | null>(null);
  const tandaNow = tanda?.key === playKey ? tanda : null;
  const handleBreak = useCallback(
    (id: string, index: number) => {
      if (id === episode.id) setTanda({ key: playKey, index });
    },
    [episode.id, playKey],
  );
  useEffect(() => {
    if (!tandaNow) return;
    const timer = window.setTimeout(() => setTanda(null), COMMERCIAL_BREAK_MS);
    return () => window.clearTimeout(timer);
  }, [tandaNow]);

  const bumper = <Bumper channelId={channelId} upcoming={upcoming} />;

  if (slot.external) {
    return (
      <TvPlayer
        key={slotKey}
        source={slot.external.source}
        startAt={play.startAt}
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
      title={showing.series.name}
      subtitle={`${episodeLabel(episode)} · ${episode.title} · ${showing.block}`}
      badge={inBreak || tandaNow ? "TANDA" : "EN VIVO"}
      badgeColor={inBreak || tandaNow ? "#7c3aed" : "#ef4444"}
      overlay={
        <>
          <VideoPlayer
            episodeId={episode.id}
            startAt={play.startAt}
            autoPlay
            live
            onEnded={handleEnded}
            onPlaying={handlePlaying}
            onUnavailable={handleUnavailable}
            breaks
            onBreak={handleBreak}
            hold={!!tandaNow}
          />
          {tandaNow && (
            <div className="absolute inset-0 z-20">
              <CommercialBreak key={`${playKey}-${tandaNow.index}`} channelId={channelId} slot={showing} upcoming={upcoming} onSkip={() => setTanda(null)} />
            </div>
          )}
          {/* La placa se desvanece cuando arranca el video (en vez de desaparecer de golpe). */}
          {!slot.external && !inBreak && (
            <div
              className={`absolute inset-0 z-20 transition-opacity duration-700 ${showIdent ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!showIdent}
            >
              <ChannelIdent key={playKey} channelId={channelId} slot={showing} transition={transition} />
            </div>
          )}
          {/* Corte con estática, como al cambiar de programa en la tele. */}
          {transition && <span key={`cut-${playKey}`} className="zap static-noise pointer-events-none absolute inset-0 z-30 bg-black" aria-hidden />}
          {showLowerThird && <LowerThird key={playKey} slot={showing} color={channel.color} ink={channel.ink} />}
          {inBreak && <div className="absolute inset-0 z-20">{bumper}</div>}
        </>
      }
      cinema={cinema}
      onCinemaChange={onCinemaChange}
      channel={tvChannel(channelId)}
    />
  );
}

/**
 * Placa del canal mientras se sintoniza el episodio nuevo (en vez de estática). Entre capítulos
 * dice "A continuación" y una barra muestra que la espera tiene tope (IDENT_MAX_MS).
 */
function ChannelIdent({ channelId, slot, transition }: { channelId: ChannelId; slot: LcSlot; transition: boolean }) {
  const c = channelById[channelId];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: c.color, color: c.ink }}>
      <div className="checker absolute inset-x-0 top-0 h-3 opacity-30" aria-hidden />
      <div className="checker absolute inset-x-0 bottom-0 h-3 opacity-30" aria-hidden />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="ident-in space-y-3">
          <p className="osd font-mono text-4xl sm:text-6xl">CH {channelNumber(channelId)}</p>
          <p className="font-display text-3xl leading-none [text-shadow:3px_3px_0_#000] sm:text-6xl">{transition ? "¡Ya sigue!" : c.name}</p>
          <SlotCard
            slot={slot}
            label={transition ? "A CONTINUACIÓN" : `AHORA · ${formatTime(slot.start)}`}
            labelClass={transition ? "text-accent" : "text-red-400"}
          />
          <div className="mx-auto h-2 w-48 overflow-hidden rounded-full border-2 border-black bg-black/40" aria-hidden>
            <div className="ident-progress h-full bg-current" style={{ animationDuration: `${IDENT_MAX_MS}ms` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ficha chica de un programa (póster, nombre y episodio) para la placa del canal y la tanda. */
function SlotCard({ slot, label, labelClass, aside }: { slot: LcSlot; label: string; labelClass: string; aside?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border-4 border-black bg-black/60 p-3 text-left text-white">
      {slot.series.poster && (
        <Image src={slot.series.poster} alt="" width={48} height={72} className="h-16 w-11 shrink-0 rounded border-2 border-black object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-lg leading-none ${labelClass}`}>{label}</p>
        <p className="truncate font-display text-lg">{slot.series.name}</p>
        <p className="truncate text-sm text-white/70">
          {episodeLabel(slot.episode)} · {slot.episode.title}
        </p>
      </div>
      {aside}
    </div>
  );
}

/** Zócalo "Estás viendo" que aparece unos segundos cuando arranca el episodio. */
function LowerThird({ slot, color, ink }: { slot: LcSlot; color: string; ink: string }) {
  return (
    <div className="lower-third pointer-events-none absolute bottom-16 left-3 z-20 max-w-[80%] sm:bottom-20 sm:left-5" aria-hidden>
      <div className="flex items-stretch overflow-hidden rounded-lg border-4 border-black shadow-[4px_4px_0_#000]">
        <span className="flex items-center px-2 font-display text-xs uppercase sm:text-sm" style={{ backgroundColor: color, color: ink }}>
          Estás viendo
        </span>
        <span className="min-w-0 bg-black/85 px-3 py-1 text-white">
          <span className="block truncate font-display text-sm sm:text-base">{slot.series.name}</span>
          <span className="block truncate font-mono text-base leading-tight text-white/75">
            {episodeLabel(slot.episode)} · {slot.episode.title}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Duración de la tanda en el medio del episodio (separador de ida, promo y separador de vuelta). */
const COMMERCIAL_BREAK_MS = 12_000;
/** Hasta acá el separador de "Ya volvemos"; después la promo; los últimos segundos, "Regresamos". */
const BREAK_OUT_MS = 3000;
const BREAK_BACK_MS = 9500;

/** Estilo de los separadores de cada canal: inspirados en la época, con diseño propio. */
const BREAK_STYLES: Record<ChannelId, { background: string; size?: string; ink: string; box: string; boxInk: string; out: string; back: string }> = {
  "cartoon-network": {
    background: "conic-gradient(#000 25%, #fff 0 50%, #000 0 75%, #fff 0)",
    size: "25% 50%",
    ink: "#000",
    box: "#000",
    boxInk: "#fff",
    out: "Ya volvemos",
    back: "Regresamos con",
  },
  nickelodeon: {
    background:
      "radial-gradient(circle at 15% 20%, #7fd63b 0 9%, transparent 9.5%), radial-gradient(circle at 85% 75%, #7fd63b 0 12%, transparent 12.5%), radial-gradient(circle at 70% 15%, #7fd63b 0 5%, transparent 5.5%), #ff7a00",
    ink: "#fff",
    box: "#7fd63b",
    boxInk: "#111",
    out: "¡No cambies de canal!",
    back: "¡Volvimos con",
  },
  jetix: {
    background: "repeating-linear-gradient(-45deg, #e4002b 0 28px, #8f001b 28px 56px)",
    ink: "#fff",
    box: "#000",
    boxInk: "#fff",
    out: "¡No te vayas!",
    back: "Sigue la acción con",
  },
  disney: {
    background:
      "radial-gradient(circle at 20% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 75% 20%, #fff 0 2px, transparent 3px), radial-gradient(circle at 60% 80%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 35% 70%, #ffe680 0 2px, transparent 3px), linear-gradient(160deg, #113ccf, #061a66)",
    ink: "#fff",
    box: "#fff",
    boxInk: "#113ccf",
    out: "Enseguida volvemos",
    back: "Volvemos con",
  },
  warner: {
    background: "repeating-radial-gradient(circle at 50% 50%, #0a2d6e 0 26px, #12408f 26px 52px)",
    ink: "#ffd400",
    box: "#ffd400",
    boxInk: "#0a2d6e",
    out: "¡Ya volvemos, amigos!",
    back: "Regresamos con",
  },
  fox: {
    background: "conic-gradient(from 200deg at 50% 110%, #f2f2f2 0 10deg, #d4d4d4 10deg 20deg, #f2f2f2 20deg 30deg, #d4d4d4 30deg 40deg, #f2f2f2 40deg)",
    ink: "#111",
    box: "#111",
    boxInk: "#f2f2f2",
    out: "Ya volvemos",
    back: "Regresamos con",
  },
};

/**
 * Tanda en el medio del episodio, como en la tele: separador de "Ya volvemos", promo de lo que viene
 * (en Cartoon Network, el clásico Ahora / Luego / Después) y separador de vuelta. Dura COMMERCIAL_BREAK_MS.
 */
function CommercialBreak({ channelId, slot, upcoming, onSkip }: { channelId: ChannelId; slot: LcSlot; upcoming: LcSlot[]; onSkip: () => void }) {
  const c = channelById[channelId];
  const style = BREAK_STYLES[channelId];
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, []);
  const phase = elapsed < BREAK_OUT_MS ? "out" : elapsed < BREAK_BACK_MS ? "promo" : "back";
  const left = Math.max(0, Math.ceil((COMMERCIAL_BREAK_MS - elapsed) / 1000));
  const boxClass = "inline-block rounded-lg border-4 border-black px-3 py-1 shadow-[4px_4px_0_#000]";

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: style.background, backgroundSize: style.size, color: style.ink }} role="status" aria-live="polite">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
        {phase === "out" && (
          <div key="out" className="bump-pop space-y-3">
            <p className={`${boxClass} font-display text-3xl leading-none sm:text-6xl`} style={{ backgroundColor: style.box, color: style.boxInk }}>
              {style.out}
            </p>
            <p className="font-display text-lg [text-shadow:2px_2px_0_#000] sm:text-2xl" style={{ color: style.ink === "#000" || style.ink === "#111" ? "#fff" : style.ink }}>
              <span className="rounded bg-black/70 px-2 py-0.5">con {slot.series.name}</span>
            </p>
          </div>
        )}
        {phase === "promo" && (
          <div key="promo" className="bump-pop w-full max-w-md space-y-2">
            {channelId === "cartoon-network" ? (
              [
                { label: "Ahora", s: slot },
                { label: "Luego", s: upcoming[0] },
                { label: "Después", s: upcoming[1] },
              ]
                .filter((x): x is { label: string; s: LcSlot } => !!x.s)
                .map(({ label, s }) => (
                  <p key={label} className="flex items-stretch overflow-hidden rounded-lg border-4 border-black bg-white text-left text-black shadow-[4px_4px_0_#000]">
                    <span className="w-28 shrink-0 bg-black px-2 py-1 font-display text-lg uppercase text-white sm:w-32 sm:text-2xl">{label}</span>
                    <span className="min-w-0 truncate px-3 py-1 font-display text-lg sm:text-2xl">{s.series.name}</span>
                  </p>
                ))
            ) : (
              <div className="space-y-2 rounded-xl border-4 border-black bg-black/75 p-3 text-left text-white shadow-[4px_4px_0_#000]">
                <p className="font-mono text-xl leading-none" style={{ color: c.color === "#f2f2f2" ? "#fff" : c.color }}>
                  MÁS TARDE EN {c.name.toUpperCase()}
                </p>
                {upcoming.slice(0, 3).map((s) => (
                  <p key={s.start} className="flex gap-3 truncate font-display text-lg sm:text-xl">
                    <span className="font-mono text-accent">{formatTime(s.start)}</span>
                    <span className="truncate">{s.series.name}</span>
                  </p>
                ))}
                {upcoming.length === 0 && <p className="font-display text-lg">Seguí con nosotros toda la noche.</p>}
              </div>
            )}
          </div>
        )}
        {phase === "back" && (
          <div key="back" className="bump-pop space-y-2">
            <p className="font-display text-xl [text-shadow:2px_2px_0_#000] sm:text-3xl">
              <span className="rounded bg-black/70 px-2 py-0.5 text-white">{style.back}</span>
            </p>
            <p className={`${boxClass} font-display text-2xl leading-tight sm:text-5xl`} style={{ backgroundColor: style.box, color: style.boxInk }}>
              {slot.series.name}
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="absolute bottom-3 right-3 z-10 rounded-md border-2 border-black bg-white/90 px-2 py-1 font-mono text-base text-black hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        Saltar tanda · {left}
      </button>
    </div>
  );
}

/** Cada cuánto cambia el aviso de "Ahora en otros canales" durante la tanda. */
const OTHER_CHANNEL_MS = 4000;

/**
 * Tanda entre programas: cuenta regresiva al próximo y su ficha, lo que viene más tarde y,
 * rotando, lo que pasan ahora los otros canales. Deja listas las fuentes del próximo.
 */
function Bumper({ channelId, upcoming }: { channelId: ChannelId; upcoming: LcSlot[] }) {
  const c = channelById[channelId];
  const next = upcoming[0];
  const later = upcoming.slice(1, 3);
  const others = useOnAir().filter((o) => o.channel.id !== channelId && o.current);
  const [tickCount, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  // Apenas empieza la tanda se piden las fuentes del próximo episodio, así arranca a horario.
  useEffect(() => {
    if (next && !next.external) prefetchStreams(next.episode.id);
  }, [next]);

  const left = next ? Math.max(0, Math.round((next.start - minutesNow(new Date())) * 60)) : 0;
  const countdown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const other = others.length > 0 ? others[Math.floor((tickCount * 1000) / OTHER_CHANNEL_MS) % others.length] : undefined;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: c.color, color: c.ink }}>
      <div className="checker absolute inset-x-0 top-0 h-3 opacity-30" aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center sm:gap-3 sm:p-6">
        <p className="font-mono text-lg opacity-80 sm:text-2xl">
          Estás viendo {c.name} · CH {channelNumber(channelId)}
        </p>
        <p className="font-display text-2xl leading-none [text-shadow:3px_3px_0_#000] sm:text-5xl">{next && left <= 30 ? "¡Ya empieza!" : "¡Ya volvemos!"}</p>
        {next && (
          <SlotCard
            slot={next}
            label={`A CONTINUACIÓN · ${formatTime(next.start)}`}
            labelClass="text-accent"
            aside={<span className="osd shrink-0 font-mono text-3xl tabular-nums">{countdown}</span>}
          />
        )}
        {later.length > 0 && (
          <ul className="hidden w-full max-w-md space-y-0.5 rounded-lg bg-black/45 px-3 py-1.5 text-left text-sm text-white sm:block">
            <li className="font-mono text-base leading-none text-white/65">MÁS TARDE</li>
            {later.map((s) => (
              <li key={s.start} className="truncate">
                <span className="mr-2 font-mono text-base text-accent">{formatTime(s.start)}</span>
                {s.series.name}
              </li>
            ))}
          </ul>
        )}
        {other?.current && (
          <p key={other.channel.id} className="lower-third hidden max-w-md items-center gap-2 truncate rounded-lg bg-black/60 px-3 py-1 text-sm text-white sm:flex">
            <span className="shrink-0 font-mono text-base text-white/65">AHORA EN</span>
            <span className="shrink-0 rounded border-2 border-black px-1.5 font-display text-xs" style={{ backgroundColor: other.channel.color, color: other.channel.ink }}>
              {other.channel.name}
            </span>
            <span className="truncate font-bold">{other.current.series.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Guía semanal: pestañas de lunes a domingo de esta semana. Hoy usa la grilla que ya está
 * cargada (la de la tele); los otros días se piden al elegirlos.
 */
function WeekGuide({ channelId, now, todaySlots, current, loading }: { channelId: ChannelId; now: Date | null; todaySlots: LcSlot[]; current?: LcSlot; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState<{ key: string; slots: LcSlot[] | null }>({ key: "", slots: null });

  const today = now ? toDateParam(now) : null;
  // Lunes a domingo de la semana actual.
  const week = now
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + i);
        return d;
      })
    : [];
  const day = selected && selected !== today ? selected : today;
  const isToday = day === today;
  const otherKey = `${channelId}|${day}`;

  useEffect(() => {
    if (isToday || !day) return;
    let cancelled = false;
    setOther({ key: otherKey, slots: null });
    loadGrids(day)
      .then((all) => {
        if (!cancelled) setOther({ key: otherKey, slots: all[channelId] ?? [] });
      })
      .catch(() => {
        if (!cancelled) setOther({ key: otherKey, slots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, day, isToday, otherKey]);

  const otherReady = other.key === otherKey && other.slots !== null;
  const tabs = (
    <div className="flex gap-1 overflow-x-auto border-b-4 border-black bg-black/60 px-2 py-1.5" role="tablist" aria-label="Días de la semana">
      {week.map((d) => {
        const key = toDateParam(d);
        const active = key === day;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setSelected(key)}
            className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-lg leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active ? "bg-accent text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {key === today ? "Hoy" : WEEKDAYS[d.getDay()]}
          </button>
        );
      })}
    </div>
  );

  const dateLabel = day ? new Date(`${day}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }) : "--";
  return (
    <ScheduleList
      title={isToday ? "Grilla de hoy" : "Grilla del día"}
      dateLabel={dateLabel}
      tabs={tabs}
      slots={isToday ? todaySlots : (other.slots ?? [])}
      current={isToday ? current : undefined}
      now={isToday ? now : null}
      loading={isToday ? loading : !otherReady}
    />
  );
}

function ScheduleList({
  slots,
  current,
  now,
  loading,
  title,
  dateLabel,
  tabs,
}: {
  slots: LcSlot[];
  current?: LcSlot;
  now: Date | null;
  loading: boolean;
  title: string;
  dateLabel: string;
  tabs?: React.ReactNode;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentStart = current?.start;

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-current='true']");
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop - 80;
    else if (listRef.current) listRef.current.scrollTop = 0;
  }, [currentStart, slots]);

  const nowMin = now ? minutesNow(now) : 0;

  return (
    <aside className="chunky flex max-h-[680px] flex-col overflow-hidden rounded-xl bg-panel">
      <div className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-2">
        <h2 className="font-display text-lg text-accent">{title}</h2>
        <span className="font-mono text-xl text-white">{dateLabel}</span>
      </div>
      {tabs}
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
                  <span className="block truncate text-sm text-white/65">
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
      <Link
        href={watchHref(slot.series.id, slot.episode.id)}
        className={className}
        onMouseEnter={() => prefetchStreams(slot.episode.id)}
        onFocus={() => prefetchStreams(slot.episode.id)}
      >
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

/** Distancia mínima (px) de un deslizamiento horizontal para cambiar de canal. */
const SWIPE_MIN_PX = 60;

/**
 * Control remoto: ↑/↓ o +/− cambian de canal, 1–6 van directo a uno, y en el celular se desliza
 * sobre la tele. Cambia de canal sin recargar la página (navegación del lado del cliente).
 */
function useRemoteControl(channelId: ChannelId) {
  const router = useRouter();
  const index = channels.findIndex((c) => c.id === channelId);
  const go = useCallback((i: number) => {
    const target = channels[(i + channels.length) % channels.length];
    router.push(`/programacion?canal=${target.id}`, { scroll: false });
  }, [router]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      // No interferir al escribir ni con los controles del reproductor (las flechas adelantan el video).
      if (target?.closest("input, textarea, select, [contenteditable], .video-js")) return;
      if (e.key === "ArrowUp" || e.key === "+" || e.key === "PageUp") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowDown" || e.key === "-" || e.key === "PageDown") {
        e.preventDefault();
        prev();
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= channels.length) {
        go(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, next, prev]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touch.current;
      touch.current = null;
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx) / 2) return;
      if (dx < 0) next();
      else prev();
    },
    [next, prev],
  );

  return { next, prev, onTouchStart, onTouchEnd };
}

/** Botonera tipo control remoto debajo de la tele. */
function RemoteBar({ channelId, onPrev, onNext }: { channelId: ChannelId; onPrev: () => void; onNext: () => void }) {
  const btn =
    "chunky inline-flex items-center gap-1 rounded-lg bg-[#c9a36b] px-3 py-1.5 font-display text-sm text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onPrev} className={btn} aria-label="Canal anterior">
        <ChevronDown className="size-4" /> CH −
      </button>
      <span className="osd rounded-lg bg-black px-3 py-1 font-mono text-2xl">CH {channelNumber(channelId)}</span>
      <button type="button" onClick={onNext} className={btn} aria-label="Canal siguiente">
        <ChevronUp className="size-4" /> CH +
      </button>
      <span className="hidden font-mono text-lg text-white/65 md:inline">Control remoto: ↑ ↓ · 1–{channels.length} · deslizá en el celular</span>
    </div>
  );
}
