"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutGrid, Library } from "lucide-react";

const links = [
  { href: "/programacion", label: "Programación", icon: CalendarClock, live: true },
  { href: "/guia", label: "Guía", icon: LayoutGrid, live: false },
  { href: "/biblioteca", label: "Biblioteca", icon: Library, live: false },
];

/** Navegación del header: marca la sección en la que estás. */
export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 sm:gap-2" aria-label="Secciones">
      {links.map(({ href, label, icon: Icon, live }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`chunky flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-bold sm:px-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white ${
              active ? "-translate-y-0.5 bg-black text-accent" : "bg-white text-black"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {/* En el celular solo se lee el nombre de la sección actual. */}
            <span className={active ? "text-sm sm:text-base" : "sr-only sm:not-sr-only"}>{label}</span>
            {live && <span className="blink size-2 rounded-full bg-red-500" aria-label="en vivo" />}
          </Link>
        );
      })}
    </nav>
  );
}
