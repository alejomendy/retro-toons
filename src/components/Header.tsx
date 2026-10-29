import Link from "next/link";
import { Tv } from "lucide-react";
import NavLinks from "./NavLinks";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b-4 border-black bg-accent text-black">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl tracking-tight">
          <span className="chunky grid size-10 place-items-center rounded-lg bg-[#ff3ea5] text-white">
            <Tv className="size-6" />
          </span>
          Retro<span className="text-[#ff3ea5]">Toons</span>
        </Link>
        <NavLinks />
      </div>
      {/* Franja a cuadros: el borde de los bumpers de la tele de los 2000 */}
      <div className="checker h-2 bg-[#ff3ea5]" aria-hidden />
    </header>
  );
}
