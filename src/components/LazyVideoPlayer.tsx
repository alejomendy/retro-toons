"use client";

import dynamic from "next/dynamic";
import { useRef, type ComponentProps } from "react";
import type VideoPlayerType from "./VideoPlayer";
import { getStreams } from "@/lib/prefetch-streams";

/** Video.js pesa ~220 kB: se baja aparte, así la página y la grilla aparecen antes. */
const VideoPlayer = dynamic(() => import("./VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" aria-hidden>
      <div className="static-noise absolute inset-0 opacity-50" />
    </div>
  ),
});

type Props = ComponentProps<typeof VideoPlayerType>;

/** El reproductor, cargado a demanda. Las fuentes se piden mientras baja el código, no después. */
export default function LazyVideoPlayer(props: Props) {
  const started = useRef("");
  if (typeof window !== "undefined" && props.episodeId && started.current !== props.episodeId) {
    started.current = props.episodeId;
    getStreams(props.episodeId).catch(() => {});
  }
  return <VideoPlayer {...props} />;
}
