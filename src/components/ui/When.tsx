"use client";

import { useNow } from "@/lib/hooks/client";
import { relativeTime } from "@/lib/format";

/** Fecha en la zona horaria del visitante + "en 3 h" / "hace 2 días", actualizado cada segundo con el reloj compartido. */
export function When({ at, withTime = true, className }: { at: string; withTime?: boolean; className?: string }) {
  const now = useNow();
  const d = new Date(at);
  const abs = d.toLocaleString("es", withTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
  return (
    <time dateTime={at} className={className} suppressHydrationWarning>
      {now === null ? d.toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" }) : abs}
      {now !== null && <span className="text-fg-dim"> · {relativeTime(d, now)}</span>}
    </time>
  );
}
