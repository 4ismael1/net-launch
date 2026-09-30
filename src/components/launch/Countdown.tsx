"use client";

import { useNow } from "@/lib/hooks/client";
import clsx from "clsx";
import { isPrecise, netLabel, splitCountdown } from "@/lib/format";

/** Cuenta regresiva calculada localmente (sin llamadas a APIs). Solo si la fecha es precisa. */
export function Countdown({
  net,
  precision,
  size = "lg",
}: {
  net: Date | string | null;
  precision: string | null;
  size?: "lg" | "sm";
}) {
  const now = useNow();

  if (!net) return <span className="num text-fg-muted">Sin fecha pública</span>;
  if (!isPrecise(precision))
    return <span className={clsx("num text-fg-muted", size === "lg" ? "text-xl" : "text-xs")}>{netLabel(net, precision)}</span>;

  const target = new Date(net).getTime();
  const c = now === null ? null : splitCountdown(target - now);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (size === "sm")
    return (
      <span className="num text-xs text-fg">
        T{c?.sign ?? "−"} {c ? `${c.d > 0 ? `${c.d}d ` : ""}${pad(c.h)}:${pad(c.m)}:${pad(c.s)}` : "--:--:--"}
      </span>
    );

  const cells: [string, string][] = c
    ? [
        [String(c.d), "días"],
        [pad(c.h), "horas"],
        [pad(c.m), "min"],
        [pad(c.s), "seg"],
      ]
    : [["--", "días"], ["--", "horas"], ["--", "min"], ["--", "seg"]];

  return (
    <div className="flex items-end gap-1" aria-label="Cuenta regresiva" role="timer">
      <span className="num mb-1 mr-1 text-2xl text-fg-dim sm:text-3xl">T{c?.sign ?? "−"}</span>
      {cells.map(([v, l], i) => (
        <div key={l} className="flex items-end gap-1">
          {i > 0 && <span className="num mb-5 text-2xl text-fg-dim sm:text-3xl">:</span>}
          <div className="flex flex-col items-center">
            <span className="num text-4xl leading-none font-medium text-fg sm:text-5xl">{v}</span>
            <span className="label mt-1.5">{l}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
