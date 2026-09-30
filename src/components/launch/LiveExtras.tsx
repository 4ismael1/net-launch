"use client";

import { CalendarClock, Play } from "lucide-react";
import { useNow } from "@/lib/hooks/client";
import type { Watch } from "@/lib/hooks/live";
import { LocalTime } from "./LocalTime";

/**
 * Botón de transmisión: aparece desde T−30 min (o antes si LL2 marca la emisión en directo).
 * «EN DIRECTO» solo cuando la fuente lo indica; si no, «Ver transmisión».
 */
export function WatchButton({ watch, net, webcastLive, className = "" }: { watch: Watch | null | undefined; net: Date | string | null; webcastLive: boolean | null; className?: string }) {
  const now = useNow();
  if (!watch || now === null) return null;
  const t = net ? new Date(net).getTime() : null;
  const inWindow = t !== null && now > t - 30 * 60_000 && now < t + 3 * 3600_000;
  if (!webcastLive && !inWindow) return null;
  return (
    <a href={watch.url} target="_blank" rel="noopener noreferrer"
      className={`animate-fade-in inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium ${webcastLive ? "bg-failure text-white hover:opacity-90" : "border border-failure/50 bg-failure/10 text-fg hover:bg-failure/20"} ${className}`}>
      {webcastLive ? <span className="size-2 animate-pulse-dot rounded-full bg-white" /> : <Play className="size-4" />}
      {webcastLive ? "EN DIRECTO · Ver" : "Ver transmisión"}
      <span className={`text-xs font-normal ${webcastLive ? "text-white/80" : "text-fg-muted"}`}>{watch.official ? "oficial" : watch.publisher ?? "externa"}</span>
    </a>
  );
}

/** Aviso cuando la fuente cambió la fecha mientras el usuario tenía la página abierta. */
export function RescheduleNotice({ before, after, precision }: { before: Date | string | null; after: Date | string | null; precision: string | null }) {
  if (!before || !after) return null;
  if (Math.abs(new Date(before).getTime() - new Date(after).getTime()) < 60_000) return null;
  return (
    <p className="animate-fade-in inline-flex items-center gap-1.5 rounded-md border border-tbc/30 bg-tbc/10 px-2.5 py-1 text-xs text-tbc">
      <CalendarClock className="size-3.5" /> Fecha actualizada por la fuente · antes: <LocalTime date={before} precision={precision} />
    </p>
  );
}
