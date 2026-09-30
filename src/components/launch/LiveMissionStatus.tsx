"use client";

import { useLive } from "@/lib/hooks/live";
import { StatusBadge } from "./StatusBadge";
import { Countdown } from "./Countdown";
import { RescheduleNotice, WatchButton } from "./LiveExtras";

type S = { statusAbbrev: string | null; statusName: string | null; net: Date | string | null; netPrecision: string | null; webcastLive: boolean | null };

/** Estado + cuenta regresiva de una misión, actualizados en vivo (retrasos, «en vuelo», resultado). */
export function LiveMissionStatus({ slug, initial, part }: { slug: string; initial: S; part: "badge" | "countdown" }) {
  const live = useLive(slug);
  const s: S = live?.launch ?? initial;
  if (part === "badge")
    return (
      <>
        <StatusBadge key={s.statusAbbrev} abbrev={s.statusAbbrev} className="animate-status-pop" />
        <span className="text-xs text-fg-dim">{s.statusName}</span>
        {s.webcastLive && <span className="rounded-sm bg-failure px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-white">EN DIRECTO</span>}
      </>
    );
  if (!["Go", "TBC", "TBD", "Hold", "In Flight"].includes(s.statusAbbrev ?? "")) return null;
  return (
    <div className="flex flex-col gap-3">
      <Countdown net={s.net} precision={s.netPrecision} status={s.statusAbbrev} />
      <RescheduleNotice before={initial.net} after={s.net} precision={s.netPrecision} />
      <WatchButton watch={live?.launch?.watch} net={s.net} webcastLive={s.webcastLive} className="self-start" />
    </div>
  );
}
