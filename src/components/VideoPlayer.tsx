"use client";

import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { lcErrorMessages, type LcErrorCode, type LcStream } from "@/lib/lacartoons-types";

type VideoPlayerProps = {
    episodeId: string;
    /** Segundos desde donde arrancar (si la fuente lo permite). */
    startAt?: number;
    /** Intentar reproducir apenas cargue la fuente (ej. al pasar al siguiente episodio). */
    autoPlay?: boolean;
    /** Se llama periódicamente, al pausar y al salir del episodio. */
    onProgress?: (episodeId: string, position: number, duration: number) => void;
    onEnded?: (episodeId: string) => void;
    /**
     * Modo "en vivo" para la programación: llena el contenedor (la tele), sin selector de fuente,
     * pasa sola a otra fuente si una falla y descuenta el tiempo que tardó en sintonizar.
     */
    live?: boolean;
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
    muted: (muted: boolean) => unknown;
    error: () => { code: number; message?: string } | null;
    on: (event: string, handler: () => void) => void;
};

/** Cada cuánto se informa el progreso mientras se reproduce. */
const PROGRESS_INTERVAL_MS = 5000;

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
    live = false,
}: VideoPlayerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<VideoJsInstance | null>(null);

    const [streams, setStreams] = useState<LcStream[]>([]);
    const [selectedStream, setSelectedStream] = useState<LcStream | null>(null);
    const [failedUrls, setFailedUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [playbackError, setPlaybackError] = useState("");

    // Valores que leen los listeners de Video.js sin tener que volver a registrarlos.
    const episodeRef = useRef(episodeId);
    const streamRef = useRef<LcStream | null>(null);
    const callbacksRef = useRef({ onProgress, onEnded });
    const pendingSeekRef = useRef(0);
    /** Cuándo se pidió el episodio (en vivo, el tiempo que pasa cargando también "sale al aire"). */
    const requestedAtRef = useRef(0);
    const liveRef = useRef(live);
    const autoPlayRef = useRef(autoPlay);
    const lastReportRef = useRef(0);
    /** Episodio cuya fuente está cargada en el player (difiere de episodeRef mientras se cambia de episodio). */
    const activeEpisodeRef = useRef("");
    const reportRef = useRef<() => void>(() => {});

    useEffect(() => {
        callbacksRef.current = { onProgress, onEnded };
    }, [onProgress, onEnded]);

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

        player.on("loadedmetadata", () => {
            const delay = isLive ? (Date.now() - requestedAtRef.current) / 1000 : 0;
            const seek = pendingSeekRef.current + delay;
            const duration = player.duration();
            pendingSeekRef.current = 0;
            if (seek > 0 && Number.isFinite(duration) && seek >= duration - 5) {
                // El punto pedido ya pasó el final del episodio (ej. en vivo, durante la tanda).
                if (activeEpisodeRef.current === episodeRef.current) {
                    callbacksRef.current.onEnded?.(activeEpisodeRef.current);
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
                    player.muted(true);
                    player.play()?.catch(() => {});
                });
            }
        });
        player.on("playing", () => setPlaybackError(""));
        player.on("timeupdate", () => {
            if (Date.now() - lastReportRef.current >= PROGRESS_INTERVAL_MS) report();
        });
        player.on("pause", report);
        player.on("ended", () => {
            report();
            if (activeEpisodeRef.current === episodeRef.current) {
                callbacksRef.current.onEnded?.(activeEpisodeRef.current);
            }
        });
        player.on("error", () => {
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
        autoPlayRef.current = autoPlay;
        requestedAtRef.current = Date.now();
        lastReportRef.current = Date.now();

        async function loadStreams() {
            setLoading(true);
            setError("");
            setPlaybackError("");
            setStreams([]);
            setFailedUrls([]);
            setSelectedStream(null);

            try {
                const request = () =>
                    fetch(`/api/series/${encodeURIComponent(episodeId)}/streams`, {
                        cache: "no-store",
                        signal: controller.signal,
                    });

                let response = await request();
                let data: unknown = await response.json().catch(() => null);
                // El addon (plan gratis) a veces tarda de más cuando está ocupado: un reintento suele alcanzar.
                if (response.status === 502 && (data as { code?: string } | null)?.code === "ADDON_UNREACHABLE") {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    response = await request();
                    data = await response.json().catch(() => null);
                }
                const body = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

                if (!response.ok || body.success !== true) {
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
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
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
            // Guardar dónde quedó el episodio que se deja.
            reportRef.current();
        };
    }, [episodeId, startAt, autoPlay]);

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

    // En vivo no hay selector: si la fuente falla se prueba la siguiente sola.
    useEffect(() => {
        if (!live || !nextUntried || !selectedStream || !failedUrls.includes(selectedStream.url)) return;
        const player = playerRef.current;
        if (player && !player.isDisposed()) {
            pendingSeekRef.current = Math.max(0, player.currentTime());
            autoPlayRef.current = true;
        }
        setSelectedStream(nextUntried);
    }, [live, nextUntried, selectedStream, failedUrls]);

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
                                    <Loader2 className="size-5 animate-spin" /> Sintonizando...
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
                            <p role="status" className="flex items-center gap-2 font-mono text-xl text-white/80">
                                <Loader2 className="size-5 animate-spin" /> Sintonizando el episodio...
                            </p>
                        ) : (
                            <p role="alert" className="flex max-w-md flex-col items-center gap-2 text-white">
                                <AlertTriangle className="size-8 text-[#ff3ea5]" />
                                {error}
                            </p>
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
                        streams.length > 1 && <span className="text-white/70">Ninguna de las fuentes disponibles pudo reproducirse.</span>
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
