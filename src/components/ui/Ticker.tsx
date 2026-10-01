"use client";

import { useNow } from "@/lib/hooks/client";
import { splitCountdown } from "@/lib/format";

/** Cuenta regresiva compacta (T− d:h:m:s) con el reloj compartido. */
export function Ticker({ at, className }: { at: string; className?: string }) {
  const now = useNow();
  if (now === null) return <span className={className}>&nbsp;</span>;
  const ms = Date.parse(at) - now;
  const c = splitCountdown(ms);
  const parts: [number, string][] = c.d ? [[c.d, "d"], [c.h, "h"], [c.m, "min"], [c.s, "s"]] : [[c.h, "h"], [c.m, "min"], [c.s, "s"]];
  return (
    <span className={`num inline-flex items-end gap-1.5 ${className ?? ""}`} aria-label="Cuenta regresiva">
      <span className="mb-1 text-fg-dim">T{c.sign}</span>
      {parts.map(([v, l], i) => (
        <span key={l} className="flex items-end gap-1.5">
          {i > 0 && <span className="mb-1 text-fg-dim">:</span>}
          <span className="flex flex-col items-center leading-none"><span>{String(v).padStart(2, "0")}</span><span className="label mt-1 !text-[9px]">{l}</span></span>
        </span>
      ))}
    </span>
  );
}
