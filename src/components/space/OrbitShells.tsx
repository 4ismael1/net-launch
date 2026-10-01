import type { Regime } from "@/lib/satcat";

// Corte a escala real de las capas orbitales: radio de la Tierra 6 371 km; GEO a 42 164 km del centro.
// Cada punto representa N objetos catalogados de esa región (posiciones ilustrativas dentro de su rango real de altitud).
const RE = 6371;
const S = 760, C = S / 2, R0 = 52; // px por radio terrestre
const r = (altKm: number) => R0 * ((RE + altKm) / RE);

// Generador pseudoaleatorio determinista (el dibujo es idéntico en servidor y cliente)
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const BANDS: Record<Exclude<Regime, "OTRA">, { min: number; max: number; name: string; note: string }> = {
  LEO: { min: 300, max: 2000, name: "Órbita baja", note: "Estaciones, Starlink, observación de la Tierra" },
  MEO: { min: 19000, max: 23500, name: "Órbita media", note: "GPS, Galileo, GLONASS, BeiDou" },
  GEO: { min: 35586, max: 35986, name: "Geoestacionaria", note: "Comunicaciones y meteorología" },
  HEO: { min: 1000, max: 39000, name: "Muy elíptica", note: "Molniya, transferencias" },
};

export function OrbitShells({ byRegime, activeByRegime, per = 40 }: { byRegime: Record<Regime, number>; activeByRegime: Record<Regime, number>; per?: number }) {
  const rand = rng(7);
  const dots: { x: number; y: number; on: boolean }[] = [];
  for (const reg of ["LEO", "MEO", "GEO", "HEO"] as const) {
    const b = BANDS[reg];
    const n = Math.round(byRegime[reg] / per), act = Math.round(activeByRegime[reg] / per);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      let alt: number;
      if (reg === "LEO") alt = 350 + Math.pow(rand(), 1.6) * 1300; // más densa entre 400 y 900 km
      else if (reg === "MEO") alt = b.min + rand() * (b.max - b.min);
      else if (reg === "GEO") alt = b.min + rand() * (b.max - b.min);
      else {
        // Elipse muy excéntrica: perigeo bajo, apogeo alto
        const e = 0.72, aSemi = (r(1000) + r(39000)) / 2, th = rand() * Math.PI * 2, rot = rand() * Math.PI * 2;
        const rr = (aSemi * (1 - e * e)) / (1 + e * Math.cos(th));
        dots.push({ x: C + rr * Math.cos(th + rot), y: C + rr * Math.sin(th + rot), on: i < act });
        continue;
      }
      const rr = r(alt);
      dots.push({ x: C + rr * Math.cos(a), y: C + rr * Math.sin(a), on: i < act });
    }
  }
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[640px]" role="img" aria-label="Corte a escala de las capas orbitales alrededor de la Tierra con la densidad de objetos">
      <defs>
        <radialGradient id="earth-g" cx="0.35" cy="0.35"><stop offset="0" stopColor="#45423b" /><stop offset="1" stopColor="#1f1e1b" /></radialGradient>
      </defs>
      {/* Guías de altitud */}
      {[{ alt: 2000, l: "2 000 km" }, { alt: 20200, l: "20 200 km" }, { alt: 35786, l: "35 786 km" }].map((g) => (
        <g key={g.alt}>
          <circle cx={C} cy={C} r={r(g.alt)} fill="none" stroke="var(--color-line)" strokeDasharray="2 5" />
          <text x={C + r(g.alt) * 0.707 + 6} y={C - r(g.alt) * 0.707 - 4} fontSize={11} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{g.l}</text>
        </g>
      ))}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.on ? 1.6 : 1.3} fill={d.on ? "var(--color-accent)" : "#a6a39a"} opacity={d.on ? 0.95 : 0.55} />)}
      <circle cx={C} cy={C} r={R0} fill="url(#earth-g)" />
      <text x={C} y={C + 4} textAnchor="middle" fontSize={12} fill="var(--color-fg)">Tierra</text>
      {/* Etiquetas de región */}
      <text x={C} y={C - r(1300) - 8} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--color-fg)">Órbita baja</text>
      <text x={C} y={C + r(21500) + 18} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--color-fg)">Órbita media</text>
      <text x={C} y={C - r(35786) + 18} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--color-fg)">Geoestacionaria</text>
    </svg>
  );
}

export const SHELL_NOTES = BANDS;
