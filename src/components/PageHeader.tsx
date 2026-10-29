/** Encabezado común de las secciones: etiqueta tipo calcomanía, título grande y bajada. */
export default function PageHeader({
  kicker,
  title,
  children,
  kickerColor = "#ff3ea5",
  kickerInk = "#ffffff",
  aside,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
  kickerColor?: string;
  kickerInk?: string;
  /** Contenido a la derecha (ej. un dato o un botón). */
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <span className="sticker inline-block rounded-md px-2.5 py-0.5 font-mono text-xl uppercase leading-tight" style={{ backgroundColor: kickerColor, color: kickerInk }}>
          {kicker}
        </span>
        <h1 className="font-display text-4xl leading-none text-accent [text-shadow:4px_4px_0_#000] sm:text-5xl">{title}</h1>
        {children && <p className="max-w-2xl text-lg text-white/75">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Título de sección dentro de una página, con su número de "bloque" a la izquierda. */
export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-black pb-2">
      <h2 id={id} className="flex items-center gap-3 font-display text-2xl text-white sm:text-3xl">
        <span className="h-7 w-2 rounded-sm bg-accent shadow-[2px_2px_0_#000]" aria-hidden />
        {children}
      </h2>
      {aside}
    </div>
  );
}
