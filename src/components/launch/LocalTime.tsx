"use client";

import { useNow, useTimeZone } from "@/lib/hooks/client";
import { netLabel, relativeTime } from "@/lib/format";

/** Fecha en la zona horaria del usuario (en el servidor se muestra en UTC hasta hidratar). */
export function LocalTime({
  date,
  precision,
  mode = "absolute",
  className,
}: {
  date: Date | string | null;
  precision?: string | null;
  mode?: "absolute" | "relative";
  className?: string;
}) {
  const tz = useTimeZone();
  if (!date) return <span className={className}>—</span>;
  if (mode === "relative") return <Relative date={date} className={className} />;
  const p = precision ?? "MIN";
  // Las fechas sin hora no llevan "UTC" (no dependen de la zona).
  const text = netLabel(date, p, tz ?? "UTC") + (!tz && ["SEC", "MIN", "HR"].includes(p) ? " UTC" : "");
  return (
    <time dateTime={new Date(date).toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}

/** "hace 3 h" que se mantiene al día (antes de hidratar, la fecha corta en UTC para no dejar hueco). */
function Relative({ date, className }: { date: Date | string; className?: string }) {
  const now = useNow();
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {now === null ? d.toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" }) : relativeTime(d, now)}
    </time>
  );
}
