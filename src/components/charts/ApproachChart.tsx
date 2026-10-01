"use client";

import { useMemo, useState } from "react";
import type { Approach } from "@/lib/data/universe";
import { useNow } from "@/lib/hooks/client";
import { sizeLabel } from "@/lib/format";

const W = 900, H = 300, PL = 44, PR = 14, PT = 14, PB = 28;

/** Distancia de paso (escala log, en distancias lunares) frente a la fecha. Tamaño del punto ~ diámetro estimado. */
export function ApproachChart({ rows, at }: { rows: Approach[]; at: number }) {
  const live = useNow();
  const now = live ?? at;
  const [hover, setHover] = useState<number | null>(null);
  const t0 = at - 30 * 864e5, t1 = at + 60 * 864e5;
  const lo = 0.1, hi = Math.max(20, ...rows.map((r) => r.distLd));
  const q = (n: number) => Math.round(n * 100) / 100;
  const x = (t: number) => q(PL + ((t - t0) / (t1 - t0)) * (W - PL - PR));
  const y = (ld: number) => q(PT + (1 - (Math.log10(Math.max(lo, ld)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (H - PT - PB));
  const pts = useMemo(
    () => rows.map((r, i) => {
      const d = r.diamKnown ?? (r.diam ? Math.sqrt(r.diam[0] * r.diam[1]) : 20);
      return { i, r, t: Date.parse(r.date), rad: Math.round(Math.max(3, Math.min(14, 2 + Math.log10(Math.max(1, d)) * 3.2)) * 100) / 100 };
    }).sort((a, b) => b.rad - a.rad),
    [rows],
  );
  const ticks = [0.1, 1, 10].filter((v) => v <= hi);
  const months = useMemo(() => {
    const out: number[] = [];
    const d = new Date(t0);
    d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    while (d.getTime() <= t1) { if (d.getTime() >= t0) out.push(d.getTime()); d.setUTCMonth(d.getUTCMonth() + 1); }
    return out;
  }, [t0, t1]);
  const h = hover !== null ? pts.find((p) => p.i === hover) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label="Asteroides que pasan cerca de la Tierra: distancia frente a fecha" onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === 1 ? undefined : "2 4"} />
            <text x={PL - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{v.toLocaleString("es")}</text>
          </g>
        ))}
        <text x={W - PR} y={y(1) - 5} textAnchor="end" fontSize={10} fill="var(--color-fg-muted)">Distancia de la Luna</text>
        {months.map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{new Date(m).toLocaleDateString("es", { month: "short", timeZone: "UTC" })}</text>
        ))}
        <line x1={x(now)} x2={x(now)} y1={PT} y2={H - PB} stroke="var(--color-accent)" strokeWidth={1} />
        <text x={x(now) + 4} y={PT + 9} fontSize={10} fill="var(--color-accent)">Ahora</text>
        {pts.map((p) => (
          <circle key={p.i} cx={x(p.t)} cy={y(p.r.distLd)} r={p.rad}
            fill={p.t < now ? "#9c988e55" : "#ecebe6cc"} stroke="var(--color-surface)" strokeWidth={2}
            className="cursor-pointer transition-[opacity] duration-200" opacity={hover === null || hover === p.i ? 1 : 0.45}
            onMouseEnter={() => setHover(p.i)} onClick={() => setHover(p.i)} />
        ))}
        <text x={8} y={PT + 4} fontSize={10} fill="var(--color-fg-dim)" transform={`rotate(-90 8 ${PT + 4})`} textAnchor="end">DL</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute z-10 w-56 rounded-md border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: `clamp(0px, calc(${(x(h.t) / W) * 100}% - 7rem), calc(100% - 14rem))`, top: `${(y(h.r.distLd) / H) * 100}%`, transform: "translateY(calc(-100% - 12px))" }}>
          <p className="font-medium text-fg">{h.r.name.replace(/^\(|\)$/g, "")}</p>
          <p className="mt-0.5 text-fg-muted">{new Date(h.r.date).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          <p className="num mt-1 text-fg">{h.r.distLd.toLocaleString("es", { maximumFractionDigits: 2 })} DL · {Math.round(h.r.distKm).toLocaleString("es")} km</p>
          <p className="text-fg-muted">{h.r.vRel.toLocaleString("es", { maximumFractionDigits: 1 })} km/s · {sizeLabel(h.r)}</p>
        </div>
      )}
    </div>
  );
}
