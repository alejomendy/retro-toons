"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { channels, isChannelId } from "@/data/channels";
import { shows } from "@/data/shows";
import ShowCover from "@/components/ShowCover";
import ChannelBadge from "@/components/ChannelBadge";
import type { ChannelId } from "@/lib/types";

type Decade = "todas" | "80s" | "90s" | "00s";
const decades: Decade[] = ["todas", "80s", "90s", "00s"];

function decadeOf(year: number): Decade {
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  return "00s";
}

export default function BibliotecaClient({ posters }: { posters: Record<string, string> }) {
  const params = useSearchParams();
  const initialChannel = params.get("canal");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelId | "todos">(isChannelId(initialChannel) ? initialChannel : "todos");
  const [decade, setDecade] = useState<Decade>("todas");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shows
      .filter((s) => channel === "todos" || s.channels.includes(channel))
      .filter((s) => decade === "todas" || decadeOf(s.year) === decade)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.originalTitle.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [query, channel, decade]);

  return (
    <div className="space-y-5">
      <div className="chunky flex flex-col gap-4 rounded-xl bg-panel p-4">
        <label className="flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-black">
          <Search className="size-5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o género..."
            className="w-full bg-transparent outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Chip active={channel === "todos"} onClick={() => setChannel("todos")}>Todos</Chip>
          {channels.map((c) => (
            <Chip key={c.id} active={channel === c.id} onClick={() => setChannel(c.id)} bg={c.color} ink={c.ink}>
              {c.name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {decades.map((d) => (
            <Chip key={d} active={decade === d} onClick={() => setDecade(d)}>
              {d === "todas" ? "Todas las décadas" : `Años ${d}`}
            </Chip>
          ))}
        </div>
      </div>

      <p className="font-mono text-xl text-white/60">{results.length} series</p>

      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((s) => (
          <li key={s.id}>
            <Link href={`/biblioteca/${s.id}`} className="chunky group block overflow-hidden rounded-xl bg-panel transition-transform hover:-translate-y-1">
              {posters[s.id] ? (
                <Image src={posters[s.id]} alt="" width={342} height={513} className="aspect-[2/3] w-full object-cover" />
              ) : (
                <ShowCover show={s} className="!aspect-[2/3]" />
              )}
              <div className="space-y-1.5 border-t-4 border-black p-3">
                <p className="font-bold leading-tight">{s.title}</p>
                <p className="text-xs text-white/60">{s.year} · {s.genre} · {s.episodeCount} episodios</p>
                <div className="flex flex-wrap gap-1">
                  {s.channels.map((c) => <ChannelBadge key={c} id={c} />)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="text-center text-white/60">No encontramos nada. Probá con otro filtro.</p>}
    </div>
  );
}

function Chip({ active, onClick, children, bg, ink }: { active: boolean; onClick: () => void; children: React.ReactNode; bg?: string; ink?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-2 border-black px-3 py-1 text-sm font-bold transition ${active ? "ring-4 ring-accent" : "opacity-75 hover:opacity-100"}`}
      style={{ backgroundColor: bg ?? (active ? "#ffd400" : "#fff"), color: ink ?? "#000" }}
    >
      {children}
    </button>
  );
}
