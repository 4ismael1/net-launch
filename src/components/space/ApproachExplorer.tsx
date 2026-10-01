"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import type { Approach } from "@/lib/data/universe";
import { useNow } from "@/lib/hooks/client";
import { ZoomPan } from "@/components/ui/ZoomPan";
import { relativeTime, sizeLabel, splitCountdown } from "@/lib/format";

const LD_KM = 384_400;
const GEO_LD = 42_164 / LD_KM; // órbita geoestacionaria (desde el centro de la Tierra)
const EARTH_LD = 6371 / LD_KM;

const clean = (n: string) => n.replace(/^\((.*)\)$/, "$1");
const ld = (v: number) => v.toLocaleString("es", { maximumFractionDigits: v < 1 ? 2 : 1 });
const mid = (r: Approach) => r.diamKnown ?? (r.diam ? Math.sqrt(r.diam[0] * r.diam[1]) : null);
const keyOf = (r: Approach) => r.des + r.date;
const dayLabel = (r: Approach) => new Date(r.date).toLocaleDateString("es", { day: "numeric", month: "short" });

// Referencias de tamaño (altura o longitud, en metros)
const REFS: { name: string; m: number; shape: "person" | "bus" | "plane" | "statue" | "tower" | "skyscraper" | "mountain" }[] = [
  { name: "una persona", m: 1.7, shape: "person" },
  { name: "un autobús", m: 12, shape: "bus" },
  { name: "un Airbus A380", m: 73, shape: "plane" },
  { name: "la Estatua de la Libertad", m: 93, shape: "statue" },
  { name: "la Torre Eiffel", m: 330, shape: "tower" },
  { name: "el Burj Khalifa", m: 828, shape: "skyscraper" },
  { name: "el monte Fuji", m: 3776, shape: "mountain" },
];

export function ApproachExplorer({ rows, at }: { rows: Approach[]; at: number }) {
  const live = useNow();
  const now = live ?? at;
  // Referencia al minuto: con la página conservada horas (Activity), los acercamientos ya pasados salen de la lista
  // y el «Hoy» del radar sigue siendo hoy. En el servidor y al hidratar vale `at`: mismo SVG.
  const refT = live === null ? at : Math.floor(live / 60_000) * 60_000;
  const upcoming = useMemo(() => rows.filter((r) => Date.parse(r.date) >= refT).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)), [rows, refT]);
  // null = sin elección explícita: la ficha muestra el próximo acercamiento
  const [sel, setSel] = useState<string | null>(null);
  const [near, setNear] = useState(false);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const picked = upcoming.find((r) => keyOf(r) === sel) ?? null;
  const cur = picked ?? upcoming[0];
  if (!cur) return null;

  /** Elegir desde el radar: la ficha se sincroniza y la tarjeta de la lista se asoma solo si ya está a la vista. */
  const pickFromRadar = (r: Approach) => {
    const k = keyOf(r);
    setSel(k);
    const el = cards.current.get(k);
    if (!el) return;
    const b = el.getBoundingClientRect();
    if (b.bottom > 0 && b.top < window.innerHeight) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
    }
  };

  // Radar: distancia REAL (lineal) desde la Tierra; el ángulo indica cuándo pasa (0 = ahora, una vuelta = 60 días)
  const S = 560, C = S / 2, R = 248;
  const maxLD = near ? 2 : Math.max(5, Math.ceil(Math.max(...upcoming.map((r) => r.distLd)) / 5) * 5);
  const rings = near ? [0.5, 1, 1.5, 2] : Array.from({ length: maxLD / 5 }, (_, i) => (i + 1) * 5);
  const q = (n: number) => Math.round(n * 100) / 100; // 2 decimales: mismo SVG en servidor y navegador
  const rr = (v: number) => q((Math.min(v, maxLD) / maxLD) * R);
  const ang = (t: number) => (((t - refT) / (60 * 864e5)) * 360 - 90) * (Math.PI / 180);
  const xy = (r: Approach) => { const a = ang(Date.parse(r.date)), d = rr(r.distLd); return [q(C + d * Math.cos(a)), q(C + d * Math.sin(a))] as const; };
  const dotR = (r: Approach) => { const m = mid(r) ?? 20; return q(Math.max(3, Math.min(11, 1.5 + Math.log10(Math.max(1, m)) * 3))); };

  const ms = Date.parse(cur.date) - now;
  const cd = splitCountdown(ms);
  const hoursToMoon = LD_KM / cur.vRel / 3600;
  const size = mid(cur);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Radar a escala */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="label !text-fg-muted">Radar de acercamientos · próximos 60 días</h2>
          <div className="flex rounded-md border border-line bg-surface-2 p-0.5 text-xs">
            {([[false, "Todos"], [true, "Muy cerca (< 2 DL)"]] as const).map(([v, l]) => (
              <button key={l} onClick={() => setNear(v)} className={clsx("rounded px-2.5 py-1 transition-colors", near === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>{l}</button>
            ))}
          </div>
        </header>
        <ZoomPan w={S} h={S} maxZoom={60} label="Radar: distancia real de cada acercamiento a la Tierra" className="mx-auto max-w-[600px]">
          {(k) => {
            const t = (px: number) => px / k; // tamaño constante en pantalla
            // Anillos de distancia que se adaptan al zoom (más finos al acercarse)
            const span = maxLD / k;
            const step = [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10].find((x) => span / x <= 5) ?? 10;
            const zr = Array.from({ length: Math.floor(maxLD / step) }, (_, i) => +(step * (i + 1)).toFixed(3));
            return (
              <>
                <defs>
                  <radialGradient id="ast-bg"><stop offset="0" stopColor="#1a1916" /><stop offset="1" stopColor="#121211" /></radialGradient>
                </defs>
                {/* Fondo: un clic fuera de los puntos vuelve al próximo acercamiento */}
                <rect x={0} y={0} width={S} height={S} fill="transparent" onClick={() => setSel(null)} />
                <circle cx={C} cy={C} r={R} fill="url(#ast-bg)" stroke="var(--color-line-strong)" strokeWidth={t(1)} onClick={() => setSel(null)} />
                {[0, 15, 30, 45].map((d) => {
                  const a = ((d / 60) * 360 - 90) * (Math.PI / 180);
                  return (
                    <g key={d}>
                      <line x1={C} y1={C} x2={C + R * Math.cos(a)} y2={C + R * Math.sin(a)} stroke="var(--color-line)" strokeWidth={t(1)} strokeDasharray={`${t(2)} ${t(5)}`} />
                      <text x={C + (R + 14) * Math.cos(a)} y={C + (R + 14) * Math.sin(a) + 4} textAnchor="middle" fontSize={11} fill="var(--color-fg-dim)" opacity={k > 1.5 ? 0 : 1}>{d === 0 ? "Hoy" : `+${d} d`}</text>
                    </g>
                  );
                })}
                {(k > 1.2 ? zr : rings).map((v) => (
                  <g key={v}>
                    <circle cx={C} cy={C} r={rr(v)} fill="none" stroke="var(--color-line)" strokeWidth={t(1)} strokeDasharray={v === 1 ? undefined : `${t(3)} ${t(5)}`} />
                    {v !== 1 && <text x={C + t(4)} y={C - rr(v) - t(4)} fontSize={t(10)} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{ld(v)} DL</text>}
                  </g>
                ))}
                {/* Órbita de la Luna (1 DL) y geoestacionaria */}
                <circle cx={C} cy={C} r={rr(1)} fill="none" stroke="#ecebe6" strokeOpacity={0.55} strokeWidth={t(1.2)} />
                <circle cx={C + rr(1)} cy={C} r={Math.max(t(near ? 5 : 3.5), rr(1737 / LD_KM))} fill="#ecebe6" />
                <text x={C + rr(1) + t(8)} y={C + t(4)} fontSize={t(11)} fill="var(--color-fg)">Luna</text>
                {(near || k > 4) && (
                  <>
                    <circle cx={C} cy={C} r={rr(GEO_LD)} fill="none" stroke="var(--color-accent)" strokeOpacity={0.5} strokeWidth={t(1)} strokeDasharray={`${t(2)} ${t(3)}`} />
                    <text x={C} y={C + rr(GEO_LD) + t(13)} textAnchor="middle" fontSize={t(9.5)} fill="var(--color-accent)">satélites geoestacionarios</text>
                  </>
                )}
                <circle cx={C} cy={C} r={Math.max(t(near ? 6 : 4.5), rr(EARTH_LD))} fill="#a6a39a" />
                <text x={C} y={C - Math.max(t(10), rr(EARTH_LD) + t(5))} textAnchor="middle" fontSize={t(11)} fill="var(--color-fg)">Tierra</text>
                {upcoming.filter((r) => !near || r.distLd <= 2).map((r) => {
                  const [x, y] = xy(r);
                  const on = r === cur;
                  const inside = r.distLd < 1;
                  const dr = t(dotR(r));
                  return (
                    <g key={keyOf(r)} role="button" tabIndex={0} aria-pressed={r === picked} aria-label={`${clean(r.name)} · ${dayLabel(r)} · ${ld(r.distLd)} DL`} suppressHydrationWarning
                      className="group cursor-pointer outline-none" onClick={() => pickFromRadar(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFromRadar(r); } }}>
                      {/* Zona de toque generosa (~12 px en pantalla a cualquier zoom) */}
                      <circle cx={x} cy={y} r={Math.max(dr + t(4), t(12))} fill="transparent" />
                      <circle cx={x} cy={y} r={dr + t(5)} fill="none" stroke="var(--color-fg)" strokeWidth={t(1.5)} className="opacity-0 transition-opacity duration-150 group-focus-visible:opacity-90" />
                      <circle cx={x} cy={y} r={dr} fill={inside ? "var(--color-accent)" : "#d8d5cc"} fillOpacity={on ? 1 : 0.8} stroke={on ? "#fff" : "var(--color-surface)"} strokeWidth={t(on ? 2 : 1.5)}
                        className="transition-[fill-opacity] duration-200" />
                      {r !== picked && (
                        <text x={x + dr + t(5)} y={y + t(3.5)} fontSize={t(10.5)} fill={on ? "var(--color-fg)" : "var(--color-fg-muted)"}
                          className={clsx("pointer-events-none transition-opacity duration-200", on || k > 2.5 ? "opacity-100" : "opacity-0 group-hover:opacity-80 group-focus-visible:opacity-100")}>{clean(r.name)}</text>
                      )}
                    </g>
                  );
                })}
                {/* Elegido: anillo de acento, línea al centro y etiqueta (nombre, fecha, distancia) dentro del dibujo */}
                {picked && (() => {
                  const [x, y] = xy(picked);
                  const dr = t(dotR(picked));
                  const name = clean(picked.name), sub = `${dayLabel(picked)} · ${ld(picked.distLd)} DL`;
                  const w = t(Math.max(name.length * 6.6, sub.length * 5.9) + 14), h = t(34);
                  const left = x + dr + t(10) + w > S - t(4); // cerca del borde derecho: a la izquierda del punto
                  const lx = left ? Math.max(t(4), x - dr - t(10) - w) : x + dr + t(10);
                  const ly = Math.min(S - h - t(4), Math.max(t(4), y - h / 2));
                  return (
                    <g key={keyOf(picked)} className="pointer-events-none animate-overlay-in">
                      <line x1={C} y1={C} x2={x} y2={y} stroke="var(--color-accent)" strokeOpacity={0.6} strokeWidth={t(1)} strokeDasharray={`${t(3)} ${t(3)}`} />
                      <circle cx={x} cy={y} r={dr + t(5)} fill="none" stroke="var(--color-accent)" strokeWidth={t(2)} />
                      <circle cx={x} cy={y} r={dr + t(10)} fill="none" stroke="var(--color-accent)" strokeOpacity={0.25} strokeWidth={t(1)} />
                      <rect x={lx} y={ly} width={w} height={h} rx={t(4)} fill="var(--color-bg)" fillOpacity={0.88} stroke="var(--color-accent)" strokeOpacity={0.45} strokeWidth={t(1)} />
                      <text x={lx + t(7)} y={ly + t(14)} fontSize={t(11)} fontWeight={600} fill="var(--color-fg)">{name}</text>
                      <text x={lx + t(7)} y={ly + t(27)} fontSize={t(10)} fill="var(--color-fg-muted)" fontFamily="var(--font-mono)" suppressHydrationWarning>{sub}</text>
                    </g>
                  );
                })()}
              </>
            );
          }}
        </ZoomPan>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-fg-muted">
          <span>La <span className="text-fg">distancia al centro es real</span> (escala lineal); el ángulo indica <span className="text-fg">cuándo</span> pasa. Toca un punto para identificarlo. Acerca con Ctrl/⌘ + rueda, pellizco o doble clic.</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Más cerca que la Luna</span>
          <span>Tamaño del punto ~ diámetro estimado</span>
        </div>
      </section>

      {/* Ficha del elegido */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <p className="label">{picked && picked !== upcoming[0] ? "Acercamiento elegido" : "Próximo acercamiento"}</p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{clean(cur.name)}</h2>
          <p className="mt-1 text-sm text-fg-muted" suppressHydrationWarning>
            {new Date(cur.date).toLocaleString("es", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {relativeTime(cur.date, now)}
          </p>
          {ms > 0 && (
            <div className="num mt-3 flex items-end gap-1.5" suppressHydrationWarning>
              {[[cd.d, "d"], [cd.h, "h"], [cd.m, "min"], [cd.s, "s"]].map(([v, l], i) => (
                <span key={l} className="flex items-end gap-1.5">
                  {i > 0 && <span className="mb-2.5 text-fg-dim">:</span>}
                  <span className="flex flex-col items-center"><span className="text-2xl leading-none">{String(v).padStart(i ? 2 : 1, "0")}</span><span className="label mt-1">{l}</span></span>
                </span>
              ))}
            </div>
          )}
        </header>

        <dl className="grid grid-cols-2 gap-px bg-line">
          <div className="bg-surface p-4">
            <dt className="label">Pasará a</dt>
            <dd className="num mt-1 text-xl">{Math.round(cur.distKm).toLocaleString("es")} km</dd>
            <dd className={clsx("mt-0.5 text-xs", cur.distLd < 1 ? "text-accent" : "text-fg-dim")}>{cur.distLd < 1 ? `Más cerca que la Luna (${Math.round(cur.distLd * 100)} % de su distancia)` : `${ld(cur.distLd)} veces la distancia a la Luna`}</dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="label">Velocidad relativa</dt>
            <dd className="num mt-1 text-xl">{cur.vRel.toLocaleString("es", { maximumFractionDigits: 1 })} km/s</dd>
            <dd className="mt-0.5 text-xs text-fg-dim">{Math.round(cur.vRel * 3600).toLocaleString("es")} km/h · iría de la Tierra a la Luna en {hoursToMoon < 1 ? `${Math.round(hoursToMoon * 60)} min` : `${hoursToMoon.toLocaleString("es", { maximumFractionDigits: 1 })} h`}</dd>
          </div>
        </dl>

        <div className="flex-1 border-t border-line p-4">
          <p className="label">Tamaño {cur.diamKnown ? "medido" : "estimado"} · {sizeLabel(cur)}</p>
          {size ? <SizeCompare m={size} range={cur.diamKnown ? null : cur.diam} /> : <p className="mt-2 text-sm text-fg-dim">Sin estimación de tamaño.</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-fg-muted">
          <span>Incertidumbre de la hora: {cur.sigma || "—"}</span>
          <a href={`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(cur.des)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-fg">Ficha en JPL <ExternalLink className="size-3" /></a>
        </footer>
      </section>

      {/* Lista: elegir también desde aquí */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface xl:col-span-2">
        <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">Próximos acercamientos <span className="num ml-1 text-fg-dim">{upcoming.length}</span></h2></header>
        <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((r) => {
            const on = r === cur;
            return (
              <li key={keyOf(r)}>
                <button ref={(el) => { if (el) cards.current.set(keyOf(r), el); else cards.current.delete(keyOf(r)); }} aria-pressed={on}
                  onClick={() => { setSel(keyOf(r)); setNear(r.distLd <= 2 && near); }} className={clsx("flex h-full w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2", on && "!bg-surface-2")}>
                  {/* Barra de distancia: la Luna marca el 100 % */}
                  <span className="relative h-8 w-1.5 shrink-0 overflow-hidden rounded-full bg-surface-3" title={`${ld(r.distLd)} DL`}>
                    <span className={clsx("absolute inset-x-0 bottom-0 rounded-full", r.distLd < 1 ? "bg-accent" : "bg-fg-muted")} style={{ height: `${Math.max(8, Math.min(100, (1 - Math.min(r.distLd, 20) / 20) * 100))}%` }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block truncate text-sm", on && "font-medium")}>{clean(r.name)}</span>
                    <span className="block text-[11px] text-fg-dim" suppressHydrationWarning>{new Date(r.date).toLocaleDateString("es", { day: "numeric", month: "short" })} · {sizeLabel(r)}</span>
                  </span>
                  <span className="num shrink-0 text-right text-sm">{ld(r.distLd)} <span className="text-[11px] text-fg-dim">DL</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Asteroide (círculo) frente a una referencia conocida, a la misma escala. */
function SizeCompare({ m, range }: { m: number; range: [number, number] | null }) {
  const ref = REFS.find((r) => r.m >= m * 0.6) ?? REFS[REFS.length - 1];
  const W = 320, H = 150, base = H - 18;
  const scale = (H - 40) / Math.max(m, ref.m);
  const d = m * scale, h = ref.m * scale;
  const ax = 90, rx = 230;
  const shape = () => {
    const w = ref.shape === "bus" || ref.shape === "plane" ? h * (ref.shape === "plane" ? 1 : 1) : h * 0.35;
    switch (ref.shape) {
      case "person": return <g><circle cx={rx} cy={base - h + h * 0.12} r={h * 0.12} /><rect x={rx - h * 0.12} y={base - h * 0.76} width={h * 0.24} height={h * 0.76} rx={h * 0.08} /></g>;
      case "bus": return <rect x={rx - w / 2} y={base - h * 0.28} width={w} height={h * 0.28} rx={h * 0.04} />;
      case "plane": return <path d={`M${rx - w / 2} ${base - h * 0.12} h${w} l-${w * 0.12} -${h * 0.1} h-${w * 0.76} z M${rx - w * 0.1} ${base - h * 0.2} l${w * 0.18} -${h * 0.2} h${w * 0.08} l-${w * 0.08} ${h * 0.2} z`} />;
      case "statue": return <path d={`M${rx - h * 0.18} ${base} h${h * 0.36} l-${h * 0.06} -${h * 0.45} h-${h * 0.24} z M${rx - h * 0.06} ${base - h * 0.45} v-${h * 0.42} h${h * 0.12} v${h * 0.42} z M${rx + h * 0.04} ${base - h * 0.87} l${h * 0.03} -${h * 0.13} l${h * 0.03} ${h * 0.13} z`} />;
      case "tower": return <path d={`M${rx - h * 0.22} ${base} L${rx} ${base - h} L${rx + h * 0.22} ${base} h-${h * 0.08} L${rx} ${base - h * 0.35} L${rx - h * 0.14} ${base} z`} />;
      case "skyscraper": return <path d={`M${rx - h * 0.08} ${base} v-${h * 0.6} l${h * 0.04} -${h * 0.2} l${h * 0.02} -${h * 0.2} l${h * 0.02} ${h * 0.2} l${h * 0.04} ${h * 0.2} v${h * 0.6} z`} />;
      default: return <path d={`M${rx - h * 1.1} ${base} L${rx - h * 0.12} ${base - h} h${h * 0.24} L${rx + h * 1.1} ${base} z`} />;
    }
  };
  const ratio = m / ref.m;
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[360px]" role="img" aria-label={`Comparación de tamaño con ${ref.name}`}>
        <line x1={10} x2={W - 10} y1={base} y2={base} stroke="var(--color-line-strong)" />
        {range && <circle cx={ax} cy={base - (range[1] * scale) / 2} r={(range[1] * scale) / 2} fill="none" stroke="var(--color-fg-dim)" strokeDasharray="2 3" />}
        <circle cx={ax} cy={base - d / 2} r={Math.max(1.5, d / 2)} fill="#8f8b82" />
        <g fill="var(--color-fg-muted)">{shape()}</g>
        <text x={ax} y={H - 3} textAnchor="middle" fontSize={10} fill="var(--color-fg-muted)">Asteroide</text>
        <text x={rx} y={H - 3} textAnchor="middle" fontSize={10} fill="var(--color-fg-muted)">{ref.name[0].toUpperCase() + ref.name.slice(1)}</text>
      </svg>
      <p className="mt-1 text-sm text-fg-muted">
        {ratio >= 0.8 && ratio <= 1.25 ? `Aproximadamente del tamaño de ${ref.name} (${ref.m.toLocaleString("es")} m).` : ratio < 1 ? `Más pequeño que ${ref.name} (${ref.m.toLocaleString("es")} m).` : `Unas ${ratio.toLocaleString("es", { maximumFractionDigits: 1 })} veces ${ref.name} (${ref.m.toLocaleString("es")} m).`}
        {range && <span className="block text-[11px] text-fg-dim">Línea discontinua: tamaño máximo posible (depende de cuánta luz refleje).</span>}
      </p>
    </div>
  );
}
