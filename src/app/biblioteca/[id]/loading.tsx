export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Cargando serie">
      <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
      <div className="chunky grid gap-6 rounded-2xl bg-panel p-5 sm:grid-cols-[200px_1fr] sm:p-8 lg:grid-cols-[240px_1fr]">
        <div className="mx-auto aspect-[2/3] w-44 animate-pulse rounded-xl bg-white/10 sm:w-full" />
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded bg-white/15" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-12 w-40 animate-pulse rounded-xl bg-white/15" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white/10" />
        ))}
      </div>
    </div>
  );
}
