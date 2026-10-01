"use client";

import { memo, useMemo } from "react";
import type { Regime } from "@/lib/satcat";
import { ZoomPan } from "@/components/ui/ZoomPan";
import { SHELL_NOTES as BANDS } from "./orbit-shells-data";

// Corte a escala real de las capas orbitales: radio de la Tierra 6 371 km; GEO a 42 164 km del centro.
// Cada punto representa N objetos catalogados de esa región (posiciones ilustrativas dentro de su rango real de altitud).
const RE = 6371;
const S = 760, C = S / 2, R0 = 52; // px por radio terrestre
const q = (n: number) => Math.round(n * 100) / 100; // 2 decimales: mismo SVG en servidor y navegador
const r = (altKm: number) => q(R0 * ((RE + altKm) / RE));

// Generador pseudoaleatorio determinista (el dibujo es idéntico en servidor y cliente)
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function makeDots(byRegime: Record<Regime, number>, activeByRegime: Record<Regime, number>, per: number) {
  const rand = rng(7);
  const dots: { x: number; y: number; on: boolean }[] = [];
  for (const reg of ["LEO", "MEO", "GEO", "HEO"] as const) {
    const b = BANDS[reg];
    const n = Math.round(byRegime[reg] / per), act = Math.round(activeByRegime[reg] / per);
    for (let i = 0; i < n; i++) {
      if (reg === "HEO") {
        // Elipse muy excéntrica: perigeo bajo, apogeo alto
        const e = 0.72, aSemi = (r(1000) + r(39000)) / 2, th = rand() * Math.PI * 2, rot = rand() * Math.PI * 2;
        const rr = (aSemi * (1 - e * e)) / (1 + e * Math.cos(th));
        dots.push({ x: q(C + rr * Math.cos(th + rot)), y: q(C + rr * Math.sin(th + rot)), on: i < act });
        continue;
      }
      const a = rand() * Math.PI * 2;
      // LEO más densa entre 400 y 900 km (Starlink ~550 km, estaciones ~400 km)
      const alt = reg === "LEO" ? 350 + Math.pow(rand(), 1.6) * 1300 : b.min + rand() * (b.max - b.min);
      const rr = r(alt);
      dots.push({ x: q(C + rr * Math.cos(a)), y: q(C + rr * Math.sin(a)), on: i < act });
    }
  }
  return dots;
}

// Capa de puntos memorizada: al desplazar (mismo zoom) no se vuelven a pintar miles de círculos
const Dots = memo(function Dots({ dots, kq }: { dots: { x: number; y: number; on: boolean }[]; kq: number }) {
  return <g>{dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={(d.on ? 1.7 : 1.35) / kq} fill={d.on ? "var(--color-accent)" : "#a6a39a"} opacity={d.on ? 0.95 : 0.55} />)}</g>;
});

export function OrbitShells({ byRegime, activeByRegime }: { byRegime: Record<Regime, number>; activeByRegime: Record<Regime, number> }) {
  // Al acercarse se dibujan más puntos (cada uno representa menos objetos)
  const coarse = useMemo(() => makeDots(byRegime, activeByRegime, 40), [byRegime, activeByRegime]);
  const fine = useMemo(() => makeDots(byRegime, activeByRegime, 10), [byRegime, activeByRegime]);
  return (
    <ZoomPan w={S} h={S} maxZoom={40} label="Corte a escala de las capas orbitales alrededor de la Tierra con la densidad de objetos" className="mx-auto max-w-[640px]">
      {(k) => {
        const dots = k >= 3 ? fine : coarse;
        const t = (px: number) => px / k; // tamaño constante en pantalla
        const guides = [
          { alt: 2000, l: "2 000 km" }, { alt: 20200, l: "20 200 km · GPS" }, { alt: 35786, l: "35 786 km" },
          ...(k >= 4 ? [{ alt: 408, l: "≈ 410 km · EEI" }, { alt: 550, l: "≈ 550 km · Starlink" }, { alt: 1200, l: "1 200 km" }] : []),
        ];
        return (
          <>
            <defs>
              <radialGradient id="earth-g" cx="0.35" cy="0.35"><stop offset="0" stopColor="#45423b" /><stop offset="1" stopColor="#1f1e1b" /></radialGradient>
            </defs>
            <rect x={0} y={0} width={S} height={S} fill="transparent" />
            {guides.map((g) => (
              <g key={g.alt}>
                <circle cx={C} cy={C} r={r(g.alt)} fill="none" stroke="var(--color-line)" strokeWidth={t(1)} strokeDasharray={`${t(2)} ${t(5)}`} />
                <text x={C + r(g.alt) * 0.707 + t(6)} y={C - r(g.alt) * 0.707 - t(4)} fontSize={t(11)} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{g.l}</text>
              </g>
            ))}
            <Dots dots={dots} kq={Math.pow(1.25, Math.round(Math.log(k) / Math.log(1.25)))} />
            <circle cx={C} cy={C} r={R0} fill="url(#earth-g)" />
            <text x={C} y={C + t(4)} textAnchor="middle" fontSize={t(12)} fill="var(--color-fg)">Tierra</text>
            <text x={C} y={C - r(1300) - t(8)} textAnchor="middle" fontSize={t(11.5)} fontWeight={600} fill="var(--color-fg)">Órbita baja</text>
            <text x={C} y={C + r(21500) + t(18)} textAnchor="middle" fontSize={t(11.5)} fontWeight={600} fill="var(--color-fg)">Órbita media</text>
            <text x={C} y={C - r(35786) + t(18)} textAnchor="middle" fontSize={t(11.5)} fontWeight={600} fill="var(--color-fg)">Geoestacionaria</text>
          </>
        );
      }}
    </ZoomPan>
  );
}
