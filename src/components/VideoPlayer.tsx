"use client";

import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { lcErrorMessages, type LcErrorCode, type LcStream } from "@/lib/lacartoons-types";
import { getSavedVolume, saveVolume } from "@/lib/user-library";
import { forgetStreams, getStreams } from "@/lib/prefetch-streams";

type VideoPlayerProps = {
    episodeId: string;
    /** Segundos desde donde arrancar (si la fuente lo permite). */
    startAt?: number;
    /** Intentar reproducir apenas cargue la fuente (ej. al pasar al siguiente episodio). */
    autoPlay?: boolean;
    /** Se llama periódicamente, al pausar y al salir del episodio. */
    onProgress?: (episodeId: string, position: number, duration: number) => void;
    /** El episodio terminó; `duration` en segundos (para decidir si entra otro antes del próximo programa). */
    onEnded?: (episodeId: string, duration: number) => void;
    /** No se pudo reproducir: sin fuentes, error al pedirlas o todas las fuentes fallaron. */
    onUnavailable?: (episodeId: string) => void;
    /** Cuando el episodio empieza a reproducirse de verdad (para transiciones en vivo). */
    onPlaying?: (episodeId: string) => void;
    /**
     * Modo "en vivo" para la programación: llena el contenedor (la tele), sin selector de fuente,
     * pasa sola a otra fuente si una falla y descuenta el tiempo que tardó en sintonizar.
     */
    live?: boolean;
    /**
     * Tandas como en la tele: avisa (onBreak) en los cortes del episodio, que se buscan como un
     * fundido a negro cerca de 1/3 y 2/3 de la duración.
     */
    breaks?: boolean;
    onBreak?: (episodeId: string, index: number) => void;
    /** Mientras es true el video queda en pausa (la tanda); al volver a false sigue solo. */
    hold?: boolean;
};

type VideoJsInstance = {
    dispose: () => void;
    isDisposed: () => boolean;
    src: (source: { src: string; type: string }) => unknown;
    load: () => unknown;
    play: () => Promise<void> | undefined;
    pause: () => unknown;
    currentTime: {
        (): number;
        (seconds: number): unknown;
    };
    duration: () => number;
    muted: {
        (): boolean;
        (muted: boolean): unknown;
    };
    volume: {
        (): number;
        (volume: number): unknown;
    };
    error: () => { code: number; message?: string } | null;
    on: (event: string, handler: () => void) => void;
};

/** Cada cuánto se informa el progreso mientras se reproduce. */
const PROGRESS_INTERVAL_MS = 5000;
/** Episodios más cortos que esto (cortos de 7-11 min) no tienen tanda en el medio. */
const MIN_BREAK_EPISODE_SECONDS = 15 * 60;
/** Tramo del episodio donde se buscan los cortes (fracción de la duración). */
const BREAK_SEARCH_FROM = 0.2;
const BREAK_SEARCH_TO = 0.85;
/** Distancia mínima entre cortes (y desde el principio), en fracción de la duración. */
const BREAK_MIN_GAP = 0.22;
/** Si no apareció un fundido a negro, los cortes van acá (fracción de la duración). */
const BREAK_FALLBACKS = [0.55, 0.82];
/** Tandas por episodio, como en la tele (3 actos). */
const MAX_BREAKS = 2;
/** Cada cuánto se mira el brillo del video dentro de la ventana. */
const BREAK_SAMPLE_MS = 250;
/** Muestras seguidas en negro para dar el corte por encontrado (~0,5 s). */
const BREAK_DARK_SAMPLES = 2;

/** ¿El cuadro actual es (casi) negro? `null` si el navegador no deja leer la imagen (video de otro origen). */
function isDarkFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean | null {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || video.readyState < 2) return false;
    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = data.length / 4;
        let sum = 0;
        let bright = 0;
        for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += lum;
            if (lum > 40) bright++;
        }
        // Se toleran unos pocos píxeles claros: el logo del canal en una esquina.
        return sum / pixels < 14 && bright / pixels < 0.04;
    } catch {
        return null;
    }
}
/** Tope para conseguir las fuentes (el servidor corta al addon a los 45 s). */
const STREAMS_TIMEOUT_MS = 50_000;
/** Después de esto se avisa que el servidor de videos está despertando. */
const SLOW_NOTICE_MS = 8000;
/** Una fuente que no carga ni los datos del video en este tiempo se da por caída. */
const LOAD_TIMEOUT_MS = 20_000;
/** Un video trabado cargando (sin avanzar) este tiempo pasa a otra fuente. */
const STALL_TIMEOUT_MS = 25_000;

/**
 * Programa un vigía: si vence con la pestaña en segundo plano (donde el navegador frena la carga)
 * se vuelve a armar en vez de dar la fuente por caída.
 */
function armWatchdog(ref: { current: number | undefined }, ms: number, onTimeout: () => void) {
    window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
        if (document.visibilityState === "hidden") armWatchdog(ref, ms, onTimeout);
        else onTimeout();
    }, ms);
}

/** Mensajes según MediaError.code (1 abortado, 2 red, 3 decodificación, 4 no soportado). */
function playbackErrorMessage(code: number | undefined, stream: LcStream | null): string {
    const headers = stream?.requiresHeaders
        ? " Esta fuente pide encabezados HTTP especiales que el navegador no puede enviar."
        : "";
    switch (code) {
        case 2:
            return `Se cortó la conexión con la fuente de video.${headers}`;
        case 3:
            return "El video no se pudo decodificar en este navegador.";
        case 4:
            return `La fuente no está disponible o su formato no es compatible con el navegador.${headers}`;
        default:
            return "Ocurrió un error durante la reproducción.";
    }
}

export default function VideoPlayer({
    episodeId,
    startAt,
    autoPlay = false,
    onProgress,
    onEnded,
    onPlaying,
    onUnavailable,
    live = false,
    breaks = false,
    onBreak,
    hold = false,
}: VideoPlayerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<VideoJsInstance | null>(null);

    const [streams, setStreams] = useState<LcStream[]>([]);
    const [selectedStream, setSelectedStream] = useState<LcStream | null>(null);
    const [failedUrls, setFailedUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [playbackError, setPlaybackError] = useState("");
    /** Las fuentes están tardando más de lo normal (el addon gratis se duerme). */
    const [slow, setSlow] = useState(false);
    /** Se sube para volver a pedir las fuentes con el botón de reintentar. */
    const [retry, setRetry] = useState(0);

    // Valores que leen los listeners de Video.js sin tener que volver a registrarlos.
    const episodeRef = useRef(episodeId);
    const streamRef = useRef<LcStream | null>(null);
    const callbacksRef = useRef({ onProgress, onEnded, onPlaying, onUnavailable });
    const pendingSeekRef = useRef(0);
    /** Cuándo se pidió el episodio (en vivo, el tiempo que pasa cargando también "sale al aire"). */
    const requestedAtRef = useRef(0);
    const liveRef = useRef(live);
    const autoPlayRef = useRef(autoPlay);
    /** El navegador bloqueó el autoplay con sonido y se silenció solo: eso no se guarda como preferencia. */
    const autoMutedRef = useRef(false);
    const lastReportRef = useRef(0);
    /** Episodio cuya fuente está cargada en el player (difiere de episodeRef mientras se cambia de episodio). */
    const activeEpisodeRef = useRef("");
    const reportRef = useRef<() => void>(() => {});
    /** Vigilan que la fuente cargue y que no quede trabada (ver LOAD_TIMEOUT_MS y STALL_TIMEOUT_MS). */
    const loadTimerRef = useRef<number | undefined>(undefined);
    const stallTimerRef = useRef<number | undefined>(undefined);
    /** Da por caída la fuente actual (la siguiente se prueba sola). */
    const failRef = useRef<(message: string) => void>(() => {});
    /** En vivo, el punto del episodio en que se pidió: al cambiar de fuente se recalcula desde acá. */
    const liveStartRef = useRef(0);

    useEffect(() => {
        callbacksRef.current = { onProgress, onEnded, onPlaying, onUnavailable };
    }, [onProgress, onEnded, onPlaying, onUnavailable]);

    // Inicializar y destruir Video.js (una sola instancia por montaje).
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // El elemento se crea acá (no en el JSX) para que React no lo toque
        // y el doble montaje de Strict Mode no deje un player huérfano.
        const videoElement = document.createElement("video-js");
        videoElement.classList.add("vjs-big-play-centered");
        videoElement.setAttribute("playsinline", "");
        container.appendChild(videoElement);

        const isLive = liveRef.current;
        const player = videojs(videoElement, {
            controls: true,
            responsive: true,
            fluid: !isLive,
            fill: isLive,
            preload: "metadata",
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            controlBar: {
                pictureInPictureToggle: true,
            },
        }) as unknown as VideoJsInstance;

        playerRef.current = player;

        // Modo «tele de verdad»: vuelve con el volumen y el silencio que dejaste.
        const savedVolume = getSavedVolume();
        if (savedVolume) {
            player.volume(savedVolume.volume);
            player.muted(savedVolume.muted);
        }
        player.on("volumechange", () => {
            if (autoMutedRef.current && player.muted()) return;
            autoMutedRef.current = false;
            saveVolume(player.volume(), player.muted());
        });

        const report = () => {
            if (player.isDisposed()) return;
            // Entre episodios el player todavía tiene el video anterior: no se informa nada.
            if (!activeEpisodeRef.current || activeEpisodeRef.current !== episodeRef.current) return;
            const position = player.currentTime();
            const duration = player.duration();
            if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
            lastReportRef.current = Date.now();
            callbacksRef.current.onProgress?.(activeEpisodeRef.current, position, duration);
        };
        reportRef.current = report;

        const clearWatchdogs = () => {
            window.clearTimeout(loadTimerRef.current);
            window.clearTimeout(stallTimerRef.current);
        };
        failRef.current = (message: string) => {
            clearWatchdogs();
            const stream = streamRef.current;
            if (!stream || player.isDisposed()) return;
            setPlaybackError(message);
            setFailedUrls((prev) => (prev.includes(stream.url) ? prev : [...prev, stream.url]));
        };
        // Cargando sin avanzar: si no se destraba solo, se pasa a otra fuente.
        player.on("waiting", () => {
            window.clearTimeout(stallTimerRef.current);
            armWatchdog(stallTimerRef, STALL_TIMEOUT_MS, () => failRef.current("El video se trabó cargando."));
        });
        player.on("canplay", () => window.clearTimeout(stallTimerRef.current));

        player.on("loadedmetadata", () => {
            window.clearTimeout(loadTimerRef.current);
            // En vivo se suma lo que tardó en cargar, salvo que arranque desde el principio (capítulo que sigue a otro).
            const delay = isLive && pendingSeekRef.current > 0 ? (Date.now() - requestedAtRef.current) / 1000 : 0;
            const seek = pendingSeekRef.current + delay;
            const duration = player.duration();
            pendingSeekRef.current = 0;
            if (seek > 0 && Number.isFinite(duration) && seek >= duration - 5) {
                // El punto pedido ya pasó el final del episodio (ej. en vivo, durante la tanda).
                if (activeEpisodeRef.current === episodeRef.current) {
                    callbacksRef.current.onEnded?.(activeEpisodeRef.current, player.duration());
                }
                return;
            }
            if (seek > 0) {
                player.currentTime(seek);
            }
            if (autoPlayRef.current) {
                player.play()?.catch(() => {
                    if (!isLive) return; // Queda el botón de play.
                    // En vivo: los navegadores dejan arrancar sin sonido; se activa desde el control de volumen.
                    autoMutedRef.current = true;
                    player.muted(true);
                    player.play()?.catch(() => {});
                });
            }
        });
        player.on("playing", () => {
            clearWatchdogs();
            setPlaybackError("");
            if (activeEpisodeRef.current && activeEpisodeRef.current === episodeRef.current) {
                callbacksRef.current.onPlaying?.(activeEpisodeRef.current);
            }
        });
        player.on("timeupdate", () => {
            if (Date.now() - lastReportRef.current >= PROGRESS_INTERVAL_MS) report();
        });
        player.on("pause", report);
        player.on("ended", () => {
            report();
            if (activeEpisodeRef.current === episodeRef.current) {
                callbacksRef.current.onEnded?.(activeEpisodeRef.current, player.duration());
            }
        });
        player.on("error", () => {
            clearWatchdogs();
            const stream = streamRef.current;
            setPlaybackError(playbackErrorMessage(player.error()?.code, stream));
            if (stream) {
                setFailedUrls((prev) => (prev.includes(stream.url) ? prev : [...prev, stream.url]));
            }
        });

        const onHide = () => {
            if (document.visibilityState === "hidden") report();
        };
        window.addEventListener("pagehide", report);
        document.addEventListener("visibilitychange", onHide);

        return () => {
            clearWatchdogs();
            report();
            window.removeEventListener("pagehide", report);
            document.removeEventListener("visibilitychange", onHide);

            if (!player.isDisposed()) {
                player.dispose();
            }

            playerRef.current = null;
            reportRef.current = () => {};
        };
    }, []);

    // Consultar las fuentes del episodio.
    useEffect(() => {
        const controller = new AbortController();
        const player = playerRef.current;

        episodeRef.current = episodeId;
        pendingSeekRef.current = startAt && startAt > 0 ? startAt : 0;
        liveStartRef.current = pendingSeekRef.current;
        autoPlayRef.current = autoPlay;
        requestedAtRef.current = Date.now();
        lastReportRef.current = Date.now();

        const slowTimer = window.setTimeout(() => setSlow(true), SLOW_NOTICE_MS);

        async function loadStreams() {
            setLoading(true);
            setSlow(false);
            setError("");
            setPlaybackError("");
            setStreams([]);
            setFailedUrls([]);
            setSelectedStream(null);

            try {
                // Si ya se pidieron de antemano (prefetch), se reusa esa misma respuesta.
                // Con tope de tiempo: nunca queda "sintonizando" para siempre.
                const request = async () => {
                    let timer: number | undefined;
                    const timeout = new Promise<never>((_, reject) => {
                        timer = window.setTimeout(() => reject(new Error(lcErrorMessages.ADDON_UNREACHABLE)), STREAMS_TIMEOUT_MS);
                    });
                    try {
                        const res = await Promise.race([getStreams(episodeId), timeout]);
                        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
                        return res;
                    } finally {
                        window.clearTimeout(timer);
                    }
                };

                let { status, data } = await request();
                // El addon (plan gratis) a veces tarda de más cuando está ocupado: un reintento suele alcanzar.
                if (status === 502 && (data as { code?: string } | null)?.code === "ADDON_UNREACHABLE") {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    forgetStreams(episodeId);
                    ({ status, data } = await request());
                }
                const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

                if (status !== 200 || body.success !== true) {
                    const code = typeof body.code === "string" ? (body.code as LcErrorCode) : undefined;
                    throw new Error(
                        typeof body.error === "string"
                            ? body.error
                            : code
                              ? lcErrorMessages[code]
                              : "No se pudieron obtener las fuentes de video."
                    );
                }

                const availableStreams = (Array.isArray(body.streams) ? body.streams : []).filter(
                    (stream): stream is LcStream =>
                        typeof stream === "object" &&
                        stream !== null &&
                        typeof (stream as LcStream).url === "string" &&
                        (stream as LcStream).url.length > 0 &&
                        typeof (stream as LcStream).mimeType === "string"
                );

                if (availableStreams.length === 0) {
                    throw new Error(lcErrorMessages.NO_STREAMS);
                }

                setStreams(availableStreams);
                setSelectedStream(availableStreams[0]);
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Ocurrió un error al cargar el episodio."
                );
                callbacksRef.current.onUnavailable?.(episodeId);
            } finally {
                window.clearTimeout(slowTimer);
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setSlow(false);
                }
            }
        }

        if (!episodeId) {
            setLoading(false);
            setError("No se indicó un episodio.");
        } else {
            if (player && !player.isDisposed()) player.pause();
            void loadStreams();
        }

        return () => {
            controller.abort();
            window.clearTimeout(slowTimer);
            // Guardar dónde quedó el episodio que se deja.
            reportRef.current();
        };
    }, [episodeId, startAt, autoPlay, retry]);

    // Configurar la fuente seleccionada.
    useEffect(() => {
        const player = playerRef.current;
        streamRef.current = selectedStream;

        if (!player || player.isDisposed() || !selectedStream) {
            return;
        }

        setPlaybackError("");
        activeEpisodeRef.current = episodeRef.current;
        player.src({
            src: selectedStream.url,
            type: selectedStream.mimeType,
        });

        player.load();
        // Si en un rato no llegan ni los datos del video, la fuente se da por caída.
        armWatchdog(loadTimerRef, LOAD_TIMEOUT_MS, () => failRef.current("La fuente de video no responde."));
    }, [selectedStream]);

    function selectStream(stream: LcStream) {
        const player = playerRef.current;
        // Al cambiar de fuente se intenta seguir desde el mismo punto.
        if (player && !player.isDisposed()) {
            const position = player.currentTime();
            if (position > 0) pendingSeekRef.current = position;
            autoPlayRef.current = position > 0 || autoPlayRef.current;
        }
        setSelectedStream(stream);
    }

    const nextUntried = streams.find(
        (s) => s.url !== selectedStream?.url && !failedUrls.includes(s.url)
    );

    // Si la fuente falla, se prueba la siguiente sola (en vivo y en la biblioteca).
    useEffect(() => {
        if (!nextUntried || !selectedStream || !failedUrls.includes(selectedStream.url)) return;
        const player = playerRef.current;
        if (player && !player.isDisposed()) {
            const position = player.currentTime();
            // En vivo se recalcula desde el punto original más lo que pasó desde que se pidió.
            pendingSeekRef.current = live ? liveStartRef.current : Math.max(pendingSeekRef.current, position);
            autoPlayRef.current = live || position > 0 || autoPlayRef.current;
        }
        setSelectedStream(nextUntried);
    }, [live, nextUntried, selectedStream, failedUrls]);

    /** Vuelve a empezar: pide las fuentes de nuevo (por si el addon ya despertó). */
    function retryAll() {
        const player = playerRef.current;
        if (player && !player.isDisposed()) {
            const position = player.currentTime();
            if (position > 0) pendingSeekRef.current = position;
        }
        forgetStreams(episodeId);
        setRetry((n) => n + 1);
    }

    const onBreakRef = useRef(onBreak);
    useEffect(() => {
        onBreakRef.current = onBreak;
    }, [onBreak]);

    // Tandas: se buscan los cortes del episodio (un fundido a negro en el tramo del medio, hasta dos por
    // episodio y separados). Si no aparece o el navegador no deja leer la imagen, van en puntos fijos.
    useEffect(() => {
        if (!breaks) return;
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 18;
        let state: { episode: string; count: number; last: number; dark: number; blind: boolean } | null = null;
        const id = window.setInterval(() => {
            const player = playerRef.current;
            const video = containerRef.current?.querySelector("video");
            if (!player || player.isDisposed() || !video || video.paused) return;
            const episode = activeEpisodeRef.current;
            if (!episode || episode !== episodeRef.current) return;
            const t = player.currentTime();
            const d = player.duration();
            if (!Number.isFinite(d) || d < MIN_BREAK_EPISODE_SECONDS) return;
            if (state?.episode !== episode) {
                // Al sintonizar a mitad del episodio, los cortes que ya pasaron no cuentan.
                const passed = BREAK_FALLBACKS.filter((f) => f * d < t + 20).length;
                state = { episode, count: passed, last: passed > 0 ? t : 0, dark: 0, blind: false };
            }
            if (state.count >= MAX_BREAKS) return;
            const fire = () => {
                const index = state!.count;
                state!.count++;
                state!.last = t;
                state!.dark = 0;
                onBreakRef.current?.(episode, index);
            };
            const fraction = t / d;
            const farEnough = t - state.last >= BREAK_MIN_GAP * d;
            if (fraction >= BREAK_FALLBACKS[state.count] && farEnough) return fire();
            if (state.blind || fraction < BREAK_SEARCH_FROM || fraction > BREAK_SEARCH_TO || !farEnough) return;
            const dark = isDarkFrame(video, canvas);
            if (dark === null) {
                state.blind = true;
                return;
            }
            state.dark = dark ? state.dark + 1 : 0;
            if (state.dark >= BREAK_DARK_SAMPLES) fire();
        }, BREAK_SAMPLE_MS);
        return () => window.clearInterval(id);
    }, [breaks]);

    // La tanda pausa el video; al terminar sigue desde el mismo punto.
    const heldRef = useRef(false);
    useEffect(() => {
        const player = playerRef.current;
        if (!player || player.isDisposed()) return;
        if (hold) {
            heldRef.current = true;
            player.pause();
        } else if (heldRef.current) {
            heldRef.current = false;
            player.play()?.catch(() => {
                autoMutedRef.current = true;
                player.muted(true);
                player.play()?.catch(() => {});
            });
        }
    }, [hold]);

    // Todas las fuentes fallaron: se avisa para que la tele pruebe con otro episodio.
    const allFailed = streams.length > 0 && streams.every((s) => failedUrls.includes(s.url));
    useEffect(() => {
        if (allFailed) callbacksRef.current.onUnavailable?.(episodeRef.current);
    }, [allFailed]);

    if (live) {
        return (
            <div className="absolute inset-0 bg-black">
                <div ref={containerRef} data-vjs-player className="absolute inset-0" />
                {(loading || error || (playbackError && !nextUntried)) && (
                    <div className="absolute inset-0 z-10 bg-black">
                        <div className="static-noise absolute inset-0 opacity-50" aria-hidden />
                        <div className="absolute inset-0 grid place-items-center p-4 text-center">
                            {loading ? (
                                <p role="status" className="flex items-center gap-2 rounded-lg bg-black/75 px-5 py-3 font-mono text-xl text-white sm:text-2xl">
                                    <Loader2 className="size-5 animate-spin" /> {slow ? "Despertando la antena..." : "Sintonizando..."}
                                </p>
                            ) : (
                                <div role="alert" className="max-w-md rounded-lg bg-black/75 px-5 py-3">
                                    <p className="font-display text-xl text-white sm:text-2xl">Sin señal</p>
                                    <p className="font-mono text-lg text-white/70">{error || playbackError}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <section className="w-full space-y-3">
            <div className="relative overflow-hidden rounded-xl border-4 border-black bg-black">
                <div ref={containerRef} data-vjs-player />

                {(loading || error) && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-black p-4 text-center">
                        {loading ? (
                            <div role="status" className="flex flex-col items-center gap-1">
                                <p className="flex items-center gap-2 font-mono text-xl text-white/80">
                                    <Loader2 className="size-5 animate-spin" /> Sintonizando el episodio...
                                </p>
                                {slow && <p className="max-w-sm text-sm text-white/65">El servidor de videos se estaba durmiendo: la primera vez puede tardar hasta medio minuto.</p>}
                            </div>
                        ) : (
                            <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-white">
                                <AlertTriangle className="size-8 text-[#ff3ea5]" />
                                <p>{error}</p>
                                <RetryButton onClick={retryAll} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {playbackError && !loading && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-black bg-[#ff3ea5]/20 px-3 py-2 text-sm text-white">
                    <AlertTriangle className="size-4 shrink-0 text-[#ff3ea5]" />
                    <span className="flex-1">{playbackError}</span>
                    {nextUntried ? (
                        <button
                            type="button"
                            onClick={() => selectStream(nextUntried)}
                            className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-white px-2 py-1 font-bold text-black hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                        >
                            <RefreshCw className="size-4" /> Probar otra fuente
                        </button>
                    ) : (
                        <>
                            {streams.length > 1 && <span className="text-white/70">Ninguna de las fuentes disponibles pudo reproducirse.</span>}
                            <RetryButton onClick={retryAll} />
                        </>
                    )}
                </div>
            )}

            {!loading && streams.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <label
                        htmlFor="video-source"
                        className="text-sm font-bold text-white/80"
                    >
                        Fuente
                    </label>

                    <select
                        id="video-source"
                        value={selectedStream?.url ?? ""}
                        onChange={(event) => {
                            const stream = streams.find(
                                (item) => item.url === event.target.value
                            );

                            if (stream) {
                                selectStream(stream);
                            }
                        }}
                        className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent sm:flex-none"
                    >
                        {streams.map((stream, index) => (
                            <option
                                key={`${stream.url}-${index}`}
                                value={stream.url}
                            >
                                {stream.label}
                                {failedUrls.includes(stream.url)
                                    ? " (falló)"
                                    : stream.notWebReady
                                      ? " (compatibilidad limitada)"
                                      : ""}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </section>
    );
}

function RetryButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
        >
            <RefreshCw className="size-4" /> Reintentar
        </button>
    );
}
