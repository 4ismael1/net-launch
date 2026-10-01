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
      {now === null ? d.toLocaleString("es", { ...(withTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }), timeZone: "UTC" }) : abs}
      {/* Hueco reservado antes de hidratar: sin salto de anchura al aparecer "en 3 h" */}
      <span className={now === null ? "invisible text-fg-dim" : "text-fg-dim"}> · {now === null ? "dentro de 0 h" : relativeTime(d, now)}</span>
    </time>
  );
}
