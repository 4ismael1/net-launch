"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useNow } from "@/lib/hooks/client";
import type { Sample } from "@/lib/data/universe";
import { SolarSystem3D } from "./SolarSystem3D";
import { AU, C_KM_S, PLANETS, au, interp, km, len, light, planetKey, planetState, probeKey, probeSpeed, sub, type SelKey, type V3 } from "./solar";

type Probe = { id: number; name: string; agency: string; launched: string; note: string; s: Sample[] };

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
  const [sel, setSel] = useState<SelKey>(() => (probes.some((p) => p.id === -31) ? probeKey(-31) : probes[0] ? probeKey(probes[0].id) : planetKey(PLANETS[2].b)));

  // Planetas para las tarjetas: se recalculan cada minuto (en la vista 3D, a cada paso de la simulación)
  const minute = Math.floor(now / 60_000);
  const planets = useMemo(() => PLANETS.map((p) => ({ ...p, ...planetState(p.b, minute * 60_000) })), [minute]);
  const earthNow: V3 = useMemo(() => (earth ? interp(earth, now) : planets[2].pos), [earth, now, planets]);

  const rows = probes.map((p) => {
    const pos = interp(p.s, now);
    return { ...p, pos, sun: len(pos), fromEarth: len(sub(pos, earthNow)), speed: probeSpeed(p.s, now) };
  });
  const cur = rows.find((r) => probeKey(r.id) === sel);
  const curPlanet = planets.find((p) => planetKey(p.b) === sel);
  const isEarth = curPlanet?.b === PLANETS[2].b;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        <SolarSystem3D probes={probes} earth={earth} sel={sel} onSel={setSel} />
        {!probes.length && (
          <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">JPL Horizons no respondió en este momento: se muestran solo el Sol y los planetas. Las sondas volverán a aparecer en unos minutos.</p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
        {cur ? (
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
            <Stats fromEarth={cur.fromEarth} sun={cur.sun} speed={cur.speed} radio />
            <p className="border-t border-line px-4 py-2.5 text-xs text-fg-muted" suppressHydrationWarning>Lleva {elapsed(cur.launched, now)} en el espacio. Valores en vivo: JPL Horizons, interpolado al segundo.</p>
            {info[cur.id] && (
              <div className="border-t border-line px-4 py-3">
                <p className="line-clamp-4 text-sm leading-relaxed text-fg-muted">{info[cur.id]!.extract}</p>
                <a href={info[cur.id]!.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] text-fg-dim hover:text-fg">Wikipedia en español →</a>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-lg border border-line bg-surface">
            <header className="border-b border-line px-4 py-4">
              <p className="label">{curPlanet ? "Planeta" : "Estrella"}</p>
              <h2 className="mt-0.5 text-xl font-semibold">{curPlanet?.name ?? "Sol"}</h2>
            </header>
            {curPlanet
              ? <Stats fromEarth={isEarth ? undefined : len(sub(curPlanet.pos, earthNow))} sun={isEarth ? len(earthNow) : len(curPlanet.pos)} speed={curPlanet.speed} />
              : <Stats fromEarth={len(earthNow)} />}
            <p className="border-t border-line px-4 py-2.5 text-xs text-fg-muted">Valores en vivo. Posición calculada con astronomy-engine (modelo planetario VSOP87) para la fecha y hora actuales.</p>
          </section>
        )}

        {rows.length > 0 && (
          <section className="rounded-lg border border-line bg-surface">
            <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">Todas las sondas · distancia a la Tierra</h2></header>
            <ul className="divide-y divide-line">
              {[...rows].sort((a, b) => b.fromEarth - a.fromEarth).map((r) => {
                const on = probeKey(r.id) === sel;
                return (
                  <li key={r.id}>
                    <button onClick={() => setSel(probeKey(r.id))} aria-pressed={on} className={clsx("flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2", on && "bg-surface-2")}>
                      <span className="flex items-center gap-2"><span className={clsx("size-1.5 rotate-45", on ? "bg-accent" : "bg-fg-muted")} />{r.name}</span>
                      <span className="num text-xs text-fg-muted" suppressHydrationWarning>{r.fromEarth > 10 * AU ? `${au(r.fromEarth)} ua` : `${km(r.fromEarth)} km`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-line bg-surface">
          <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">El Sol y los planetas</h2></header>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5 lg:grid-cols-2 2xl:grid-cols-5">
            {[{ key: "sun", name: "Sol", color: "#ffd9a0" }, ...PLANETS.map((p) => ({ key: planetKey(p.b), name: p.name, color: p.color }))].map((p) => {
              const on = p.key === sel;
              return (
                <button key={p.key} onClick={() => setSel(p.key)} aria-pressed={on} className={clsx("flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2", on ? "bg-surface-2 text-fg" : "bg-surface text-fg-muted")}>
                  <span className={clsx("size-2 shrink-0 rounded-full", on && "ring-1 ring-accent ring-offset-2 ring-offset-surface-2")} style={{ background: p.color }} />{p.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {rows.length > 0 && <Ladder rows={rows.map((r) => ({ id: r.id, name: r.name, d: r.fromEarth }))} sel={sel} onSel={(id) => setSel(probeKey(id))} />}
    </div>
  );
}

function Stats({ fromEarth, sun, speed, radio }: { fromEarth?: number; sun?: number; speed?: number; radio?: boolean }) {
  const cell = (label: string, main: string, sub2: string) => (
    <div className="min-w-0 bg-surface p-4"><dt className="label">{label}</dt><dd className="num mt-1 text-lg leading-tight break-words" suppressHydrationWarning>{main}</dd><dd className="num text-xs text-fg-dim" suppressHydrationWarning>{sub2}</dd></div>
  );
  return (
    // Celdas de ancho mínimo: con columnas estrechas pasan a una sola (las cifras largas nunca se cortan)
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12.5rem),1fr))] gap-px bg-line">
      {fromEarth != null && cell("Distancia a la Tierra", `${km(fromEarth)} km`, `${au(fromEarth)} ua`)}
      {sun != null && cell("Distancia al Sol", `${km(sun)} km`, `${au(sun)} ua`)}
      {fromEarth != null && cell(radio ? "Señal de radio tarda" : "La luz tarda", light(fromEarth / C_KM_S), "en llegar a la Tierra")}
      {speed != null && cell("Velocidad respecto al Sol", `${speed.toLocaleString("es", { maximumFractionDigits: 2 })} km/s`, `${km(speed * 3600)} km/h`)}
    </dl>
  );
}

/** Distancias desde la Tierra en escala logarítmica, con referencias conocidas y el tiempo que tarda la luz. */
function Ladder({ rows, sel, onSel }: { rows: { id: number; name: string; d: number }[]; sel: SelKey; onSel: (id: number) => void }) {
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
            const on = probeKey(r.id) === sel;
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
