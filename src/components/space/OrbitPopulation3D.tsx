"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Clock, Maximize2, Minus, Pause, Play, Plus, RotateCw, Search, X } from "lucide-react";
import { useStoredFlag } from "@/lib/hooks/client";
import { OBJ_LABEL, OBJ_TYPES, TYPE_COLORS, type ObjType } from "@/lib/satcat";
import type { Population, PopRow } from "@/lib/satellites";
import { GLOBE_PAUSED } from "@/components/orbit/earth";
import { GlobeHint, useWheelHint } from "@/components/orbit/GlobeHint";
import { PopulationEngine, rowToOmm, type PopLive } from "@/components/orbit/PopulationEngine";
import { classify, orbitParams, sgp4Note } from "@/components/orbit/orbitMeta";

const COLORS = OBJ_TYPES.map((t) => TYPE_COLORS[t]);
const SINGULAR = ["Carga útil", "Etapa de cohete", "Fragmento", "Sin identificar"];
const REGIME_NAME = { LEO: "Órbita baja", MEO: "Órbita media", GEO: "Geoestacionaria", HEO: "Muy elíptica" } as const;
const SHELLS = [
  { altKm: 2000, label: "2 000 km · fin de la órbita baja" },
  { altKm: 20200, label: "20 200 km · GPS" },
  { altKm: 35786, label: "35 786 km · geoestacionaria" },
];
const VIEWS = [
  { r: 1.36, label: "Órbita baja" },
  { r: 4.35, label: "Media" },
  { r: 6.75, label: "Todo" },
];
const RATES = [1, 60, 600];
const nf = (n: number) => n.toLocaleString("es");

export function OrbitPopulation3D({ onOrbit, catalogByType }: { onOrbit: number; catalogByType: Record<ObjType, number> }) {
  const [data, setData] = useState<Population | null>(null);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<PopulationEngine | null>(null);
  const labelEls = useRef<(HTMLSpanElement | null)[]>([]);
  const [wheelHint, pingHint] = useWheelHint();
  const [sel, setSel] = useState<number | null>(null);
  const selRef = useRef<number | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [mask, setMask] = useState([true, true, true, true]);
  const maskRef = useRef(mask);
  const [rate, setRate] = useState(1); // 1 = hora real
  const [playing, setPlaying] = useState(true);
  const clockRef = useRef({ rate: 1, playing: true });
  const [paused, setPaused] = useStoredFlag(GLOBE_PAUSED);
  const spin = !paused;
  const [q, setQ] = useState("");

  // Elementos orbitales (una vez; el servidor cachea CelesTrak)
  useEffect(() => {
    if (data) return;
    const ctrl = new AbortController();
    fetch("/api/satellites/population", { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Population>; })
      .then((p) => { if (p.rows?.length) setData(p); else setFailed(true); })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, [data]);

  // Motor 3D: se crea con los datos y se recrea al volver a la página (Activity); todo se libera al ocultarla
  useEffect(() => {
    if (!data || !host.current) return;
    const e = new PopulationEngine(host.current, COLORS, pingHint);
    engine.current = e;
    e.onPick = (i) => setSel(i);
    e.onHover = (i, x, y) => setHover(i == null ? null : { i, x, y });
    e.setLabels(SHELLS.map((s, k) => ({ el: labelEls.current[k]!, altKm: s.altKm })).filter((l) => l.el));
    e.setMask(maskRef.current);
    const c = clockRef.current;
    e.setClock(c.playing && c.rate === 1, c.playing ? c.rate : 0);
    let alive = true;
    e.load(data.rows, (done, total) => { if (alive) setProgress(done < total ? [done, total] : null); })
      .then(() => { if (alive && selRef.current != null) e.select(selRef.current); });
    return () => { alive = false; e.dispose(); engine.current = null; };
  }, [data, pingHint]);

  useEffect(() => { selRef.current = sel; engine.current?.select(sel ?? -1); }, [sel]);
  useEffect(() => { maskRef.current = mask; engine.current?.setMask(mask); }, [mask]);
  useEffect(() => {
    clockRef.current = { rate, playing };
    engine.current?.setClock(playing && rate === 1, playing ? rate : 0);
  }, [rate, playing]);

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0];
    for (const r of data?.rows ?? []) c[r[13]]++;
    return c;
  }, [data]);
  const total = data?.rows.length ?? 0;

  const qt = q.trim().toUpperCase();
  const results = useMemo(() => {
    if (!data || qt.length < 2) return [];
    const out: number[] = [];
    const num = /^\d+$/.test(qt);
    for (let i = 0; i < data.rows.length && out.length < 8; i++) {
      const r = data.rows[i];
      if (num ? String(r[0]).startsWith(qt) : r[1].toUpperCase().includes(qt)) out.push(i);
    }
    return out;
  }, [data, qt]);

  const toggleType = (k: number) => {
    const next = mask.map((v, j) => (j === k ? !v : v));
    setMask(next);
    if (sel != null && data && !next[data.rows[sel][13]]) setSel(null);
  };
  const choose = (i: number) => {
    setQ("");
    const k = data!.rows[i][13];
    if (!mask[k]) setMask(mask.map((v, j) => (j === k ? true : v)));
    setSel(i);
  };

  if (failed) {
    return (
      <section className="rounded-lg border border-line bg-surface px-5 py-10 text-center">
        <p className="font-medium">La vista 3D no está disponible ahora mismo</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">No se pudieron obtener los elementos orbitales de CelesTrak. Las cifras del catálogo siguen más abajo; vuelve a intentarlo en unos minutos.</p>
      </section>
    );
  }

  const selRow = sel != null && data ? data.rows[sel] : null;
  const missing = Math.max(0, onOrbit - total);

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="pob3d-title">
      {/* Encabezado: qué se ve, búsqueda y encuadres */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-3.5 md:px-5">
        <div className="min-w-0">
          <p className="label">A escala real · simulación con datos reales</p>
          <h2 id="pob3d-title" className="mt-0.5 text-xl font-semibold tracking-tight md:text-2xl">Así de lleno está el espacio cercano</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {data ? <><span className="num text-fg">{nf(total)}</span> objetos con posición calculada · toca o haz clic en uno para identificarlo</> : "Cargando los elementos orbitales…"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o NORAD…" aria-label="Buscar un objeto en la vista" disabled={!data}
              className="h-8 w-full rounded-md border border-line bg-bg pr-3 pl-8 text-[13px] placeholder:text-fg-dim focus:border-line-strong focus:outline-none disabled:opacity-50" />
            {qt.length >= 2 && data && (
              <ul className="absolute inset-x-0 top-9 z-30 max-h-72 overflow-y-auto rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
                {results.length === 0 ? <li className="px-3 py-2 text-xs text-fg-dim">Sin resultados entre los objetos dibujados.</li> : results.map((i) => {
                  const r = data.rows[i];
                  return (
                    <li key={r[0]}><button onClick={() => choose(i)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-3">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[r[13]] }} />
                      <span className="min-w-0 flex-1 truncate">{r[1]}</span><span className="num shrink-0 text-[11px] text-fg-dim">{r[0]}</span>
                    </button></li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex rounded-md border border-line bg-bg p-0.5 text-xs" role="group" aria-label="Encuadre">
            {VIEWS.map((v) => (
              <button key={v.label} onClick={() => engine.current?.frame(v.r)} disabled={!data}
                className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50">{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[clamp(420px,72dvh,780px)] bg-[radial-gradient(circle_at_50%_50%,#161614,#0b0b0a_75%)]">
        {data ? (
          <>
            <div ref={host} className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing" role="img"
              aria-label={`Globo 3D con ${nf(total)} objetos en órbita terrestre a escala real: ${OBJ_TYPES.map((t, k) => `${nf(counts[k])} ${OBJ_LABEL[t].toLowerCase()}`).join(", ")}. Posiciones calculadas con SGP4.`} />
            {SHELLS.map((s, k) => (
              <span key={s.altKm} ref={(el) => { labelEls.current[k] = el; }} aria-hidden
                className="num pointer-events-none absolute top-0 left-0 z-[1] whitespace-nowrap rounded-sm bg-bg/70 px-1 text-[10px] text-fg-dim opacity-0 transition-opacity duration-300">{s.label}</span>
            ))}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-square w-[min(60%,420px)] animate-pulse rounded-full border border-line">
              <div className="absolute inset-[30%] rounded-full bg-surface-2" />
              <div className="absolute inset-[22%] rounded-full border border-dashed border-line" />
            </div>
            <p className="absolute bottom-4 text-xs text-fg-dim">Descargando elementos orbitales (CelesTrak)…</p>
          </div>
        )}
        {progress && (
          <p className="num pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto w-fit rounded-md bg-bg/85 px-2.5 py-1 text-xs text-fg-muted">
            Calculando posiciones · {nf(progress[0])} / {nf(progress[1])}
          </p>
        )}
        {hover && data && hover.i !== sel && (
          <div className="pointer-events-none absolute z-10 max-w-60 rounded-md border border-line bg-bg/90 px-2 py-1 text-xs backdrop-blur" style={{ left: hover.x + 12, top: hover.y + 12 }}>
            <span className="block truncate">{data.rows[hover.i][1]}</span>
            <span className="text-[10.5px] text-fg-dim">{SINGULAR[data.rows[hover.i][13]]} · NORAD {data.rows[hover.i][0]}</span>
          </div>
        )}
        <GlobeHint show={wheelHint} />

        {data && (
          <>
            {/* Reloj y velocidad del tiempo */}
            <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg/85 p-1 text-xs backdrop-blur">
              <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pausar la simulación" : "Reanudar la simulación"} title={playing ? "Pausar" : "Reanudar"}
                className="flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg">
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <span className={clsx("flex items-center gap-1.5 px-1", !playing ? "text-fg-muted" : rate === 1 ? "text-go" : "text-tbc")}>
                {!playing ? "En pausa" : rate === 1 ? <><Clock className="size-3.5" /> Hora real</> : <>Tiempo ×{rate}</>}
                <SimClock engine={engine} />
              </span>
              <span className="flex rounded bg-surface-2 p-0.5">
                {RATES.map((w) => (
                  <button key={w} onClick={() => { setRate(w); setPlaying(true); }} aria-pressed={playing && rate === w}
                    className={clsx("num rounded px-1.5 py-0.5 transition-colors", playing && rate === w ? "bg-surface-3 text-fg" : "text-fg-dim hover:text-fg")}>×{w}</button>
                ))}
              </span>
            </div>

            {/* Controles de vista */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
              <CtlBtn label={spin ? "Pausar giro automático" : "Reanudar giro automático"} onClick={() => setPaused(spin)} active={spin}><RotateCw className="size-4" /></CtlBtn>
              <CtlBtn label="Acercar" onClick={() => engine.current?.zoomBy(0.8)}><Plus className="size-4" /></CtlBtn>
              <CtlBtn label="Alejar" onClick={() => engine.current?.zoomBy(1.25)}><Minus className="size-4" /></CtlBtn>
              <CtlBtn label="Reencuadrar" onClick={() => engine.current?.resetView()}><Maximize2 className="size-4" /></CtlBtn>
            </div>

            {!selRow && <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] text-fg-dim md:block">Arrastra para girar · rueda o pellizco para acercar · clic en un punto para identificarlo</p>}
            {selRow && sel != null && <InfoCard key={selRow[0]} engine={engine} index={sel} row={selRow} source={data.sources[selRow[15]]?.label ?? ""} onClose={() => setSel(null)} />}
          </>
        )}
      </div>

      {/* Leyenda con filtros, cobertura y procedencia */}
      <div className="grid gap-3 border-t border-line px-4 py-3 md:px-5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mostrar u ocultar por tipo de objeto">
          {OBJ_TYPES.map((t, k) => (
            <button key={t} onClick={() => toggleType(k)} aria-pressed={mask[k]} disabled={!data}
              className={clsx("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-60",
                mask[k] ? "border-line-strong bg-surface-2 text-fg" : "border-line text-fg-dim hover:text-fg")}>
              <span className={clsx("size-2.5 shrink-0 rounded-full transition-opacity", !mask[k] && "opacity-30")} style={{ background: TYPE_COLORS[t] }} />
              <span>{OBJ_LABEL[t]}</span>
              <span className="num text-[11px] text-fg-dim">{data ? nf(counts[k]) : "—"}<span className="hidden sm:inline"> de {nf(catalogByType[t])}</span></span>
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-fg-dim">
          {data && <>Se dibujan los {nf(total)} objetos cuyos elementos orbitales publica CelesTrak en descargas abiertas por grupos ({data.sources.filter((s) => s.count != null).map((s) => s.label.charAt(0).toLowerCase() + s.label.slice(1)).join(", ")}). </>}
          {missing > 0 && <>Los otros ≈ {nf(missing)} objetos del catálogo (sobre todo etapas y fragmentos de otras rupturas) no se publican así y no se dibujan: no inventamos posiciones. </>}
          {data?.sources.some((s) => s.count == null) && <>No disponible ahora: {data.sources.filter((s) => s.count == null).map((s) => s.label.charAt(0).toLowerCase() + s.label.slice(1)).join(", ")}. </>}
          El tipo de objeto se deduce de su nombre en el catálogo («R/B», «DEB»). Posición calculada (SGP4) desde elementos orbitales; la época de cada objeto figura en su ficha. Puntos no a escala (los objetos miden de centímetros a decenas de metros). Fuente: CelesTrak.
        </p>
      </div>
    </section>
  );
}

/** Hora mostrada (real o simulada): solo se repinta ella. */
function SimClock({ engine }: { engine: RefObject<PopulationEngine | null> }) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setT(engine.current?.time ?? null);
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [engine]);
  return t ? <span className="num text-fg-muted">{new Date(t).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> : null;
}

/** Ficha del objeto elegido: datos de sus elementos y estado calculado cada medio segundo. */
function InfoCard({ engine, index, row, source, onClose }: { engine: RefObject<PopulationEngine | null>; index: number; row: PopRow; source: string; onClose: () => void }) {
  const [live, setLive] = useState<PopLive | null>(null);
  useEffect(() => {
    const tick = () => setLive(engine.current?.live(index) ?? null);
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [engine, index]);
  const omm = useMemo(() => rowToOmm(row), [row]);
  const { period, apo, per } = orbitParams(omm);
  const reg = classify(omm);
  const f = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d });
  const type = row[13];
  return (
    <div className="animate-fade-in absolute right-3 bottom-3 left-3 z-20 max-h-[calc(100%-4.5rem)] overflow-y-auto rounded-lg border border-line-strong bg-bg/92 p-3.5 backdrop-blur md:left-auto md:w-80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label mb-0.5 flex items-center gap-1.5 truncate">
            <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[type] }} />
            {SINGULAR[type]}{row[14] === 1 && " · operativo"}
          </p>
          <p className="truncate font-medium">{row[1]}</p>
          <p className="num text-[11px] text-fg-dim">NORAD {row[0]}{row[2] && ` · ${row[2]}`}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar ficha"><X className="size-4" /></button>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><dt className="label">Región</dt><dd>{REGIME_NAME[reg]}</dd></div>
        <div><dt className="label">Altitud ahora</dt><dd className="num">{live ? `${f(live.alt)} km` : "—"}</dd></div>
        <div><dt className="label">Perigeo · apogeo</dt><dd className="num">{f(per)} · {f(apo)} km</dd></div>
        <div><dt className="label">Velocidad</dt><dd className="num">{live ? `${f(live.speed, 2)} km/s` : "—"}</dd></div>
        <div><dt className="label">Periodo</dt><dd className="num">{period >= 120 ? `${f(period / 60, 1)} h` : `${f(period, 1)} min`}</dd></div>
        <div><dt className="label">Inclinación</dt><dd className="num">{f(row[6], 1)}°</dd></div>
      </dl>
      <p className="mt-2 text-[10.5px] leading-snug text-fg-dim">{sgp4Note([omm])}. Conjunto: {source}.</p>
      <Link href={`/satelites/${row[0]}`} className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        Ficha, traza y pasos sobre ti <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}

function CtlBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={clsx("flex size-8 items-center justify-center rounded-md border bg-bg/85 backdrop-blur transition-colors", active ? "border-line-strong text-fg" : "border-line text-fg-muted hover:text-fg")}>
      {children}
    </button>
  );
}
