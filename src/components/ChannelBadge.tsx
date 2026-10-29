import { channelById } from "@/data/channels";
import type { ChannelId } from "@/lib/types";

export default function ChannelBadge({ id }: { id: ChannelId }) {
  const c = channelById[id];
  return (
    <span
      className="inline-block rounded border-2 border-black px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide"
      style={{ backgroundColor: c.color, color: c.ink }}
    >
      {c.name}
    </span>
  );
}
