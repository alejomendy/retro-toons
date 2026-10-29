import Link from "next/link";
import { AlertTriangle, SearchX, Tv } from "lucide-react";

type Tone = "error" | "empty" | "info";
const icons = { error: AlertTriangle, empty: SearchX, info: Tv };

/** Mensaje de error / estado vacío con el estilo de la app. */
export default function StateMessage({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string } | React.ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="chunky flex flex-col items-center gap-3 rounded-xl bg-panel px-6 py-10 text-center"
    >
      <Icon className={`size-10 ${tone === "error" ? "text-[#ff3ea5]" : "text-accent"}`} aria-hidden />
      <p className="font-display text-xl text-white">{title}</p>
      {children && <div className="max-w-md text-sm text-white/70">{children}</div>}
      {action &&
        (isLinkAction(action) ? (
          <Link
            href={action.href}
            className="chunky mt-1 rounded-lg bg-accent px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
          >
            {action.label}
          </Link>
        ) : (
          action
        ))}
    </div>
  );
}

function isLinkAction(a: unknown): a is { href: string; label: string } {
  return typeof a === "object" && a !== null && "href" in a && "label" in a;
}
