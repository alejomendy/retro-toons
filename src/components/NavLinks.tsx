"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutGrid, Library, Puzzle } from "lucide-react";

const links = [
  { href: "/programacion", label: "Programación", short: "En vivo", icon: CalendarClock, live: true },
  { href: "/guia", label: "Guía", short: "Guía", icon: LayoutGrid, live: false },
  { href: "/biblioteca", label: "Biblioteca", short: "Biblioteca", icon: Library, live: false },
  { href: "/addons", label: "Addons", short: "Addons", icon: Puzzle, live: false },
];

function useActive() {
  const pathname = usePathname();
  // Las colecciones salen de los addons: se marcan dentro de esa sección.
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/addons" && pathname.startsWith("/colecciones"));
}

/** Navegación del header (tablet y escritorio): marca la sección en la que estás. */
export default function NavLinks() {
  const isActive = useActive();
  return (
    <nav className="hidden gap-2 sm:flex" aria-label="Secciones">
      {links.map(({ href, label, icon: Icon, live }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`chunky flex items-center gap-2 rounded-lg px-3 py-1.5 font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${
              active ? "-translate-y-0.5 bg-black text-accent" : "bg-white text-black"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {live && <span className="blink size-2 rounded-full bg-red-500" aria-label="en vivo" />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de pestañas fija abajo en el celular: al alcance del pulgar y con el nombre de cada sección. */
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-black bg-accent pb-[env(safe-area-inset-bottom)] text-black sm:hidden"
      aria-label="Secciones"
    >
      <ul className="grid grid-cols-4">
        {links.map(({ href, short, icon: Icon, live }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white ${
                  active ? "bg-black text-accent" : "text-black"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {short}
                {live && <span className="blink absolute right-[calc(50%-1.1rem)] top-1.5 size-2 rounded-full bg-red-500" aria-label="en vivo" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
