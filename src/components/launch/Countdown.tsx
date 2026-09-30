"use client";

import clsx from "clsx";
import { useNow } from "@/lib/hooks/client";
import { isPrecise, netLabel, splitCountdown } from "@/lib/format";

const PENDING = ["Go", "TBC", "TBD", "Hold"];
const DONE = ["Success", "Failure", "Partial Failure"];

/**
 * Cuenta regresiva calculada localmente (sin llamadas a APIs). Solo si la fecha es precisa.
 * Tras T−0 es honesta: si la fuente aún no confirma el despegue muestra «esperando confirmación»;
 * «en vuelo» solo cuando la fuente lo confirma; con resultado deja de contar.
 */
export function Countdown({
  net,
  precision,
  size = "lg",
  status,
}: {
  net: Date | string | null;
  precision: string | null;
  size?: "lg" | "md" | "sm";
  status?: string | null;
}) {
  const now = useNow();

  if (!net) return <span className="num text-fg-muted">Sin fecha pública</span>;
  if (!isPrecise(precision))
    return <span className={clsx("num text-fg-muted", size === "sm" ? "text-xs" : "text-xl")}>{netLabel(net, precision)}</span>;

  const target = new Date(net).getTime();
  const past = now !== null && now >= target;
  const c = now === null ? null : splitCountdown(target - now);
  const pad = (n: number) => String(n).padStart(2, "0");

  // Tras T−0
  const flying = past && status === "In Flight";
  const waiting = past && (!status || PENDING.includes(status));
  const finished = past && !!status && DONE.includes(status);
  const hold = status === "Hold";
  const note = flying ? "En vuelo · confirmado por la fuente" : hold ? "Cuenta regresiva en espera (HOLD) · puede cambiar la hora" : waiting ? "Hora prevista superada · esperando confirmación" : null;

  if (finished && size !== "sm") {
    return <span className="num text-sm text-fg-muted">Lanzado · resultado publicado</span>;
  }

  if (size === "sm")
    return (
      <span className={clsx("num text-xs", waiting ? "text-tbc" : flying ? "text-flight" : "text-fg")}>
        T{c?.sign ?? "−"} {c ? `${c.d > 0 ? `${c.d}d ` : ""}${pad(c.h)}:${pad(c.m)}:${pad(c.s)}` : "--:--:--"}
        {waiting && " · por confirmar"}
      </span>
    );

  const md = size === "md";
  const cells: [string, string][] = c
    ? [[String(c.d), "días"], [pad(c.h), "horas"], [pad(c.m), "min"], [pad(c.s), "seg"]]
    : [["--", "días"], ["--", "horas"], ["--", "min"], ["--", "seg"]];

  return (
    <div>
      <div className="flex items-end gap-1" aria-label="Cuenta regresiva" role="timer">
        <span className={clsx("num mr-1", flying ? "text-flight" : waiting ? "text-tbc" : "text-fg-dim", md ? "mb-4 text-xl" : "mb-1 text-2xl sm:text-3xl")}>
          T{c?.sign ?? "−"}
        </span>
        {cells.map(([v, l], i) => (
          <div key={l} className="flex items-end gap-1">
            {i > 0 && <span className={clsx("num text-fg-dim", md ? "mb-4 text-xl" : "mb-5 text-2xl sm:text-3xl")}>:</span>}
            <div className="flex flex-col items-center">
              <span className={clsx("num leading-none font-medium text-fg", md ? "text-3xl" : "text-4xl sm:text-5xl")}>{v}</span>
              <span className="label mt-1.5">{l}</span>
            </div>
          </div>
        ))}
      </div>
      {note && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-xs", flying ? "text-flight" : hold ? "text-hold" : "text-tbc")}>
          <span className={clsx("size-1.5 rounded-full animate-pulse-dot", flying ? "bg-flight" : hold ? "bg-hold" : "bg-tbc")} />
          {note}
        </p>
      )}
    </div>
  );
}
