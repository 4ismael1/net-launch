"use client";

import { useNow } from "@/lib/hooks/client";
import { isExact, isPrecise, netLabel, splitCountdown } from "@/lib/format";

/** Cuenta regresiva compacta (T− d:h:m:s) con el reloj compartido. Respeta la precisión de la fecha. */
export function Ticker({ at, precision, className }: { at: string; precision?: string | null; className?: string }) {
  const now = useNow();
  if (!isPrecise(precision)) return <span className={`num ${className ?? ""}`}>{netLabel(at, precision)}</span>;
  const approx = !isExact(precision);
  const c = now === null ? null : splitCountdown(Date.parse(at) - now);
  const all: [number | null, string][] = c
    ? (c.d ? [[c.d, "d"], [c.h, "h"], [c.m, "min"], [c.s, "s"]] : [[c.h, "h"], [c.m, "min"], [c.s, "s"]])
    : [[null, "h"], [null, "min"], [null, "s"]];
  // Con precisión de hora: solo días y horas (sin falsa precisión).
  const parts = approx ? all.filter(([, l]) => l === "d" || l === "h") : all;
  return (
    <span className={`num inline-flex items-end gap-1.5 ${className ?? ""}`} role="timer" aria-label="Cuenta regresiva">
      <span className="mb-1 text-fg-dim">{approx && "≈"}T{c?.sign ?? "−"}</span>
      {parts.map(([v, l], i) => (
        <span key={l} className="flex items-end gap-1.5">
          {i > 0 && <span className="mb-1 text-fg-dim">:</span>}
          <span className="flex flex-col items-center leading-none"><span>{v === null ? "--" : String(v).padStart(2, "0")}</span><span className="label mt-1 !text-[9px]">{l}</span></span>
        </span>
      ))}
    </span>
  );
}
