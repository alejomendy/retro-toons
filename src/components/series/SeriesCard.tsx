import Image from "next/image";
import Link from "next/link";
import { Tv } from "lucide-react";
import { seriesHref } from "@/lib/lacartoons-types";

/** Póster de una serie de LACartoons, o un marco vacío si el catálogo no trae imagen. */
export function SeriesPoster({ src, name, sizes, priority }: { src: string | null; name: string; sizes: string; priority?: boolean }) {
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden bg-black/50">
      {src ? (
        <Image src={src} alt={`Póster de ${name}`} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="grid h-full place-items-center p-3 text-center">
          <Tv className="size-10 text-white/30" aria-hidden />
        </div>
      )}
    </div>
  );
}

interface Props {
  id: string;
  name: string;
  poster: string | null;
  /** Línea secundaria (ej. cadena). */
  meta?: string;
  /** Etiquetas bajo el título (ej. canales). */
  badges?: React.ReactNode;
  children?: React.ReactNode;
}

/** Tarjeta de serie del catálogo, consistente en búsqueda, favoritos y "Continuar viendo". */
export default function SeriesCard({ id, name, poster, meta, badges, children }: Props) {
  return (
    <div className="chunky group relative flex h-full flex-col overflow-hidden rounded-xl bg-panel transition-transform focus-within:-translate-y-1 hover:-translate-y-1 motion-reduce:transition-none">
      <Link
        href={seriesHref(id)}
        className="flex flex-1 flex-col outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <SeriesPoster src={poster} name={name} sizes="(min-width: 1024px) 270px, (min-width: 640px) 30vw, 45vw" />
        <div className="flex-1 space-y-1.5 border-t-4 border-black p-3">
          <p className="line-clamp-2 font-bold leading-tight">{name}</p>
          {meta && <p className="text-xs text-white/60">{meta}</p>}
          {badges}
        </div>
      </Link>
      {children}
    </div>
  );
}

export function SeriesGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>;
}

export function SeriesCardSkeleton() {
  return (
    <div className="chunky overflow-hidden rounded-xl bg-panel" aria-hidden>
      <div className="aspect-[2/3] animate-pulse bg-white/10" />
      <div className="space-y-2 border-t-4 border-black p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/15" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
