import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="font-display text-4xl text-accent sm:text-6xl">404</h2>
      <p className="mt-2 text-xl font-bold text-white">Página no encontrada</p>
      <p className="mt-1 text-white/70">No pudimos encontrar la señal o página que estás buscando.</p>
      <Link
        href="/"
        className="chunky mt-6 rounded-lg bg-accent px-5 py-2.5 font-bold text-black transition-transform hover:-translate-y-0.5"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

