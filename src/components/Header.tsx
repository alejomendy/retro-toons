import Link from "next/link";
import { CalendarClock, Library, Tv } from "lucide-react";

const links = [
  { href: "/programacion", label: "Programación", icon: CalendarClock },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
];

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
        <nav className="flex gap-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="chunky flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 font-bold transition-transform hover:-translate-y-0.5"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
