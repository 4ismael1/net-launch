"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Body, HelioVector, RotateVector, Rotation_EQJ_ECL } from "astronomy-engine";
import { useNow } from "@/lib/hooks/client";
import type { Sample } from "@/lib/data/universe";

type Probe = { id: number; name: string; agency: string; launched: string; note: string; s: Sample[] };

const AU = 149_597_870.7;
const C_KM_S = 299_792.458;
const S = 800, C = S / 2;
// Escala radial logarítmica: 0 → centro, 0,1 ua → 35 px, 1 ua → 120 px, 30 ua → 285 px, 170 ua → 370 px
const K = 115;
const R = (au: number) => K * Math.log10(1 + au / 0.1);

const PLANETS: { b: Body; name: string; a: number; size: number }[] = [
  { b: Body.Mercury, name: "Mercurio", a: 0.387, size: 2.5 }, { b: Body.Venus, name: "Venus", a: 0.723, size: 3.5 },
  { b: Body.Earth, name: "Tierra", a: 1, size: 4 }, { b: Body.Mars, name: "Marte", a: 1.524, size: 3 },
  { b: Body.Jupiter, name: "Júpiter", a: 5.203, size: 6 }, { b: Body.Saturn, name: "Saturno", a: 9.537, size: 5.5 },
  { b: Body.Uranus, name: "Urano", a: 19.19, size: 4.5 }, { b: Body.Neptune, name: "Neptuno", a: 30.07, size: 4.5 },
  { b: Body.Pluto, name: "Plutón", a: 39.48, size: 2 },
];

function at(s: Sample[], t: number): [number, number, number] {
  let i = s.findIndex((x) => x[0] > t) - 1;
  if (i < 0) i = t < s[0][0] ? 0 : s.length - 2;
  const a = s[Math.max(0, i)], b = s[Math.min(s.length - 1, Math.max(0, i) + 1)];
  const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}
const len = (v: [number, number, number]) => Math.hypot(v[0], v[1], v[2]);
const sub = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const km = (v: number) => Math.round(v).toLocaleString("es");
const au = (v: number) => (v / AU).toLocaleString("es", { maximumFractionDigits: v / AU < 10 ? 3 : 2 });
function light(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s` : `${m} min ${String(s).padStart(2, "0")} s`;
}
function elapsed(from: string, now: number) {
  const ms = now - Date.parse(`${from}T00:00:00Z`);
  const y = Math.floor(ms / (365.25 * 864e5));
  const d = Math.floor((ms - y * 365.25 * 864e5) / 864e5);
  return `${y} años y ${d} días`;
}

type Info = { extract: string; url: string; image: string | null } | null;

export function ProbesView({ probes, earth, at: serverAt, info }: { probes: Probe[]; earth: Sample[] | null; at: number; info: Record<number, Info> }) {
  const live = useNow();
  const now = live ?? serverAt;
  const [sel, setSel] = useState(probes.find((p) => p.id === -31)?.id ?? probes[0]?.id ?? 0);

  const rot = useMemo(() => Rotation_EQJ_ECL(), []);
  // Planetas: se recalculan cada minuto (se mueven muy despacio a esta escala)
  const minute = Math.floor(now / 60_000);
  const planets = useMemo(() => {
    const d = new Date(minute * 60_000);
    return PLANETS.map((p) => {
      const v = RotateVector(rot, HelioVector(p.b, d));
      return { ...p, x: v.x, y: v.y, z: v.z };
    });
  }, [minute, rot]);
  const earthNow: [number, number, number] = useMemo(() => {
    if (earth) return at(earth, now);
    const e = planets.find((p) => p.b === Body.Earth)!;
    return [e.x * AU, e.y * AU, e.z * AU];
  }, [earth, now, planets]);

  const rows = probes.map((p) => {
    const pos = at(p.s, now);
    const next = at(p.s, now + 60_000);
    const sun = len(pos);
    const fromEarth = len(sub(pos, earthNow));
    return { ...p, pos, sun, fromEarth, speed: len(sub(next, pos)) / 60 };
  });
  const cur = rows.find((r) => r.id === sel) ?? rows[0];

  // Etiquetas sin solaparse: se colocan de fuera hacia dentro y se omiten las que chocan (la elegida siempre)
  const placed: { x: number; y: number; w: number }[] = [];
  const pt = (x: number, y: number, z: number) => {
    const r = Math.hypot(x, y, z), ang = Math.atan2(y, x), rr = R(r);
    return [C + rr * Math.cos(ang), C - rr * Math.sin(ang)] as const;
  };
  const labels = [...rows].sort((a, b) => Number(b.id === sel) - Number(a.id === sel) || b.sun - a.sun).map((r) => {
    const [x, y] = pt(r.pos[0] / AU, r.pos[1] / AU, r.pos[2] / AU);
    const w = r.name.length * 6.2 + 8;
    const free = !placed.some((p) => Math.abs(p.y - y) < 14 && x + w > p.x && x < p.x + p.w);
    if (free || r.id === sel) placed.push({ x, y, w });
    return { id: r.id, x, y, show: free || r.id === sel };
  });

  if (!cur) return null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[720px] select-none" role="img" aria-label="Sistema solar visto desde arriba, escala logarítmica, con la posición actual de las sondas">
          <defs>
            <radialGradient id="sun"><stop offset="0" stopColor="#ffd9a0" /><stop offset="0.5" stopColor="#ff9a3d" stopOpacity="0.6" /><stop offset="1" stopColor="#ff5b1f" stopOpacity="0" /></radialGradient>
          </defs>
          {/* Cinturón de Kuiper y heliopausa */}
          <circle cx={C} cy={C} r={(R(30) + R(50)) / 2} fill="none" stroke="#ecebe60a" strokeWidth={R(50) - R(30)} />
          <circle cx={C} cy={C} r={R(120)} fill="none" stroke="var(--color-accent)" strokeOpacity={0.35} strokeDasharray="3 6" />
          <text x={C} y={C - R(120) - 6} textAnchor="middle" fontSize={11} fill="var(--color-accent)" fillOpacity={0.7}>Heliopausa · ≈ 120 ua</text>
          <text x={C} y={C - (R(30) + R(50)) / 2 + 4} textAnchor="middle" fontSize={10} fill="var(--color-fg-dim)">Cinturón de Kuiper</text>
          {PLANETS.map((p) => <circle key={p.name} cx={C} cy={C} r={R(p.a)} fill="none" stroke="var(--color-line-strong)" strokeOpacity={0.8} />)}
          {[1, 10, 100].map((v) => (
            <text key={v} x={C + R(v) + 3} y={C + 12} fontSize={9.5} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{v} ua</text>
          ))}
          <circle cx={C} cy={C} r={16} fill="url(#sun)" />
          <circle cx={C} cy={C} r={4} fill="#ffd9a0" />
          {planets.map((p) => {
            const [x, y] = pt(p.x, p.y, p.z);
            return (
              <g key={p.name}>
                <circle cx={x} cy={y} r={p.size} fill={p.b === Body.Earth ? "#7fb2d8" : "#a6a39a"} />
                <text x={x} y={y + p.size + 11} textAnchor="middle" fontSize={10} fill="var(--color-fg-muted)">{p.name}</text>
              </g>
            );
          })}
          {rows.map((r) => {
            const l = labels.find((x) => x.id === r.id)!;
            const on = r.id === sel;
            return (
              <g key={r.id} className="cursor-pointer" onClick={() => setSel(r.id)}>
                <circle cx={l.x} cy={l.y} r={12} fill="transparent" />
                <rect x={l.x - 4} y={l.y - 4} width={8} height={8} transform={`rotate(45 ${l.x} ${l.y})`} fill={on ? "var(--color-accent)" : "#ecebe6"} stroke="var(--color-surface)" strokeWidth={2} />
                {on && <circle cx={l.x} cy={l.y} r={10} fill="none" stroke="var(--color-accent)" strokeOpacity={0.6} />}
                {l.show && <text x={l.x + 9} y={l.y + 3.5} fontSize={11} fontWeight={on ? 600 : 400} fill={on ? "var(--color-fg)" : "var(--color-fg-muted)"}>{r.name}</text>}
              </g>
            );
          })}
        </svg>
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Vista desde el polo norte de la eclíptica. Distancia al Sol en escala logarítmica (cada anillo de 1, 10 y 100 ua); la dirección es real. Posiciones: JPL Horizons, interpoladas al segundo.</p>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
        <section className="rounded-lg border border-line bg-surface">
          <header className="flex gap-4 border-b border-line px-4 py-4">
            {info[cur.id]?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={cur.id} src={info[cur.id]!.image!} alt="" className="size-24 shrink-0 animate-fade-in rounded-md bg-surface-3 object-cover" />
            )}
            <div className="min-w-0">
              <p className="label">{cur.agency} · lanzada el {new Date(`${cur.launched}T00:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</p>
              <h2 className="mt-0.5 text-xl font-semibold">{cur.name}</h2>
              <p className="mt-1 text-sm text-fg-muted">{cur.note}</p>
            </div>
          </header>
          <dl className="grid grid-cols-2 gap-px bg-line">
            <div className="bg-surface p-4"><dt className="label">Distancia a la Tierra</dt><dd className="num mt-1 text-lg leading-tight" suppressHydrationWarning>{km(cur.fromEarth)} km</dd><dd className="num text-xs text-fg-dim" suppressHydrationWarning>{au(cur.fromEarth)} ua</dd></div>
            <div className="bg-surface p-4"><dt className="label">Distancia al Sol</dt><dd className="num mt-1 text-lg leading-tight" suppressHydrationWarning>{km(cur.sun)} km</dd><dd className="num text-xs text-fg-dim" suppressHydrationWarning>{au(cur.sun)} ua</dd></div>
            <div className="bg-surface p-4"><dt className="label">Señal de radio tarda</dt><dd className="num mt-1 text-lg leading-tight" suppressHydrationWarning>{light(cur.fromEarth / C_KM_S)}</dd><dd className="text-xs text-fg-dim">en llegar a la Tierra</dd></div>
            <div className="bg-surface p-4"><dt className="label">Velocidad respecto al Sol</dt><dd className="num mt-1 text-lg leading-tight" suppressHydrationWarning>{cur.speed.toLocaleString("es", { maximumFractionDigits: 2 })} km/s</dd><dd className="num text-xs text-fg-dim" suppressHydrationWarning>{km(cur.speed * 3600)} km/h</dd></div>
          </dl>
          <p className="border-t border-line px-4 py-2.5 text-xs text-fg-muted" suppressHydrationWarning>Lleva {elapsed(cur.launched, now)} en el espacio.</p>
          {info[cur.id] && (
            <div className="border-t border-line px-4 py-3">
              <p className="line-clamp-4 text-sm leading-relaxed text-fg-muted">{info[cur.id]!.extract}</p>
              <a href={info[cur.id]!.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] text-fg-dim hover:text-fg">Wikipedia en español →</a>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface">
          <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">Todas las sondas · distancia a la Tierra</h2></header>
          <ul className="divide-y divide-line">
            {[...rows].sort((a, b) => b.fromEarth - a.fromEarth).map((r) => (
              <li key={r.id}>
                <button onClick={() => setSel(r.id)} className={clsx("flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2", r.id === sel && "bg-surface-2")}>
                  <span className="flex items-center gap-2"><span className={clsx("size-1.5 rotate-45", r.id === sel ? "bg-accent" : "bg-fg-muted")} />{r.name}</span>
                  <span className="num text-xs text-fg-muted" suppressHydrationWarning>{r.fromEarth > 10 * AU ? `${au(r.fromEarth)} ua` : `${km(r.fromEarth)} km`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Ladder rows={rows.map((r) => ({ id: r.id, name: r.name, d: r.fromEarth }))} sel={sel} onSel={setSel} />
    </div>
  );
}

/** Distancias desde la Tierra en escala logarítmica, con referencias conocidas y el tiempo que tarda la luz. */
function Ladder({ rows, sel, onSel }: { rows: { id: number; name: string; d: number }[]; sel: number; onSel: (id: number) => void }) {
  const W = 1000, H = 172, L = 20, Rr = 980, AX = 114;
  const lo = Math.log10(300_000), hi = Math.log10(30 * 1e9); // de 300 000 km a 30 000 millones de km
  const x = (km: number) => L + ((Math.log10(Math.max(km, 300_000)) - lo) / (hi - lo)) * (Rr - L);
  const refs: [string, number][] = [["Luna", 384_400], ["L2 (Webb)", 1.5e6], ["Sol", AU], ["Júpiter (media)", 5.2 * AU], ["Plutón (media)", 39.5 * AU], ["Heliopausa", 120 * AU]];
  const lightTicks: [string, number][] = [["1 s luz", C_KM_S], ["1 min luz", C_KM_S * 60], ["1 h luz", C_KM_S * 3600], ["1 día luz", C_KM_S * 86400]];
  const sorted = [...rows].sort((a, b) => a.d - b.d);
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface lg:col-span-2">
      <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">Escalera de distancias desde la Tierra</h2></header>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block min-w-[720px] w-full select-none" role="img" aria-label="Distancia de cada sonda a la Tierra en escala logarítmica">
          <line x1={L} x2={Rr} y1={AX} y2={AX} stroke="var(--color-line-strong)" />
          {lightTicks.map(([l, km]) => (
            <g key={l}>
              <line x1={x(km)} x2={x(km)} y1={AX - 4} y2={AX + 4} stroke="var(--color-fg-dim)" />
              <text x={x(km)} y={AX + 30} textAnchor="middle" fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{l}</text>
            </g>
          ))}
          {refs.map(([l, km]) => (
            <g key={l}>
              <circle cx={x(km)} cy={AX} r={3} fill="var(--color-fg-muted)" />
              <text x={x(km)} y={AX + 16} textAnchor="middle" fontSize={10.5} fill="var(--color-fg-muted)">{l}</text>
            </g>
          ))}
          {sorted.map((r, i) => {
            const on = r.id === sel;
            const y = AX - 16 - (i % 4) * 22;
            return (
              <g key={r.id} className="cursor-pointer" onClick={() => onSel(r.id)}>
                <line x1={x(r.d)} x2={x(r.d)} y1={y + 4} y2={AX - 5} stroke={on ? "var(--color-accent)" : "var(--color-line-strong)"} />
                <rect x={x(r.d) - 4} y={AX - 4} width={8} height={8} transform={`rotate(45 ${x(r.d)} ${AX})`} fill={on ? "var(--color-accent)" : "#ecebe6"} />
                <text x={x(r.d)} y={y} textAnchor="middle" fontSize={11} fontWeight={on ? 600 : 400} fill={on ? "var(--color-fg)" : "var(--color-fg-muted)"}>{r.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Cada marca grande multiplica la distancia: la luz tarda 1,3 s en llegar a la Luna, 8 min al Sol y casi un día entero a la Voyager 1.</p>
    </section>
  );
}
