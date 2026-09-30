"use client";

import { useTimeZone } from "@/lib/hooks/client";
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
  const text =
    mode === "relative" ? (tz ? relativeTime(date) : "") : netLabel(date, precision ?? "MIN", tz ?? "UTC") + (tz ? "" : " UTC");
  return (
    <time dateTime={new Date(date).toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
