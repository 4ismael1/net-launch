"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useStoredFlag } from "@/lib/hooks/client";
import { GLOBE_PAUSED } from "./earth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowUpRight, Check, Clock, Info, Loader2, Maximize2, Minus, Pause, Play, Plus, Search, X } from "lucide-react";
import type { OMM } from "@/lib/orbit";
import type { GroupCategory } from "@/lib/satellites";
import { SatEngine, type LiveInfo } from "./SatEngine";
import { ICON_LABEL, iconDataUrl, iconFor, type IconKind } from "./satIcons";
import { SatTable } from "./SatTable";
import { GlobeHint, useWheelHint } from "./GlobeHint";
import { sgp4Note } from "./orbitMeta";

export type GroupMeta = { key: string; label: string; cat: GroupCategory; desc: string };

// Paleta categórica fija en tonos cálidos y neutros (sin azules ni morados). Máx. 8 grupos a la vez: nunca se repiten colores.
const PALETTE = ["#ff5b1f", "#ecebe6", "#f5b83d", "#b5d25f", "#c9785d", "#a6a39a", "#ffb08c", "#d9b98c"];
const MAX = PALETTE.length;
const EXTRA = "__extra";
const DEFAULT_GROUPS = "stations,gps-ops";

type Sel = { list: string[]; slot: Record<string, number> };
/** Cada grupo conserva su color mientras siga marcado; los nuevos toman el primer color libre. */
function reslot(prev: Record<string, number>, list: string[]): Sel {
  const slot: Record<string, number> = {};
  const used = new Set<number>();
  for (const g of list) if (prev[g] != null && !used.has(prev[g])) { slot[g] = prev[g]; used.add(prev[g]); }
  for (const g of list) if (slot[g] == null) { const free = PALETTE.findIndex((_, i) => !used.has(i)); slot[g] = free; used.add(free); }
  return { list, slot };
}

export function SatExplorer({ groups, categories, featured }: {
  groups: GroupMeta[];
  categories: Record<GroupCategory, string>;
  featured: { norad: number; name: string; note: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SatEngine | null>(null);
  const [wheelHint, pingHint] = useWheelHint();

  const parseGroups = (g: string | null) => (g ?? DEFAULT_GROUPS).split(",").filter((k) => groups.some((x) => x.key === k)).slice(0, MAX);
  const parseSat = (s: string | null) => (s && Number(s) > 0 ? Number(s) : null);
  const [sel, setSel] = useState<Sel>(() => reslot({}, parseGroups(sp.get("g"))));
  const selected = sel.list;
  const setSelected = (list: string[]) => setSel((s) => reslot(s.slot, list));
  const [data, setData] = useState<Record<string, OMM[]>>({});
  const inflight = useRef(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<OMM[]>([]); // añadidos desde la búsqueda
  const [focus, setFocus] = useState<number | null>(() => parseSat(sp.get("sat")));
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ q: string; rows: { norad: number; name: string; id: string }[] | null } | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [icons, setIcons] = useState<Partial<Record<IconKind, string>>>({});
  const [legendOpen, setLegendOpen] = useState(false);
  const [paused, setPaused] = useStoredFlag(GLOBE_PAUSED);
  const spin = !paused;
  const [warp, setWarp] = useState(1);
  const warpRef = useRef(1);

  // URL → estado: enlaces internos (p. ej. «?g=stations») y la página conservada por Next al volver (Activity).
  // Se ajusta durante el render, como en WorldMap, para que el efecto de abajo nunca pise la URL nueva.
  const urlKey = sp.toString();
  const [seenUrl, setSeenUrl] = useState(urlKey);
  // Un enlace sin parámetros (menú) conserva la selección actual; el efecto de abajo la vuelve a escribir en la URL.
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    if (urlKey) {
      const p = new URLSearchParams(urlKey);
      const g = parseGroups(p.has("g") ? p.get("g") : null);
      if (g.join() !== selected.join()) setSel((s) => reslot(s.slot, g));
      const f = parseSat(p.get("sat"));
      if (f !== focus) setFocus(f);
    }
  }

  const colorOf = (g: string) => (g === EXTRA ? "#ffffff" : PALETTE[sel.slot[g]] ?? "#8f8b82");

  // Motor 3D (se recrea al volver a la página: recupera el ritmo del tiempo elegido)
  useEffect(() => {
    if (!host.current) return;
    const e = new SatEngine(host.current, pingHint);
    e.onPick = (n) => setFocus(n);
    e.onHover = (name, x, y) => setHover(name ? { name, x, y } : null);
    if (warpRef.current !== 1) e.setWarp(warpRef.current);
    engine.current = e;
    setIcons(Object.fromEntries((Object.keys(ICON_LABEL) as IconKind[]).map((k) => [k, iconDataUrl(k, 16)])));
    return () => { e.dispose(); engine.current = null; };
  }, [pingHint]);

  // Carga de grupos (una vez por grupo; el servidor cachea CelesTrak)
  useEffect(() => {
    for (const g of selected) {
      if (data[g] || errors[g] || inflight.current.has(g)) continue;
      inflight.current.add(g);
      fetch(`/api/satellites/group/${g}`)
        .then(async (r) => { if (!r.ok) throw new Error(r.status === 503 ? "CelesTrak no disponible" : "Error"); return r.json(); })
        .then((rows: OMM[]) => setData((d) => ({ ...d, [g]: rows })))
        .catch((e: Error) => setErrors((x) => ({ ...x, [g]: e.message })))
        .finally(() => inflight.current.delete(g));
    }
  }, [selected, data, errors]);
  const isLoading = (g: string) => selected.includes(g) && !data[g] && !errors[g];
  const allLoaded = selected.every((g) => data[g] || errors[g]);

  // Conjunto visible → motor
  const visible = useMemo(() => {
    const seen = new Set<number>();
    const out: { omm: OMM; group: string }[] = [];
    for (const g of selected) for (const o of data[g] ?? []) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); out.push({ omm: o, group: g }); }
    for (const o of extra) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); out.push({ omm: o, group: EXTRA }); }
    return out;
  }, [selected, data, extra]);
  const omms = useMemo(() => visible.map((v) => v.omm), [visible]);

  useEffect(() => {
    engine.current?.setSatellites(
      visible.map((v) => ({ ...v, color: colorOf(v.group), icon: iconFor(v.group, v.omm.OBJECT_NAME) })),
      focus,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => { engine.current?.selectNorad(focus); }, [focus]);

  // Satélite pedido por la URL que no está en los grupos marcados: se añade (una vez) desde el catálogo
  const tried = useRef(new Set<number>());
  useEffect(() => {
    if (!focus || !allLoaded || tried.current.has(focus) || visible.some((v) => v.omm.NORAD_CAT_ID === focus)) return;
    tried.current.add(focus);
    fetch(`/api/satellites/obj/${focus}`)
      .then((r) => (r.ok ? (r.json() as Promise<OMM>) : null))
      .then((o) => { if (o) setExtra((e) => [...e.filter((x) => x.NORAD_CAT_ID !== o.NORAD_CAT_ID), o]); })
      .catch(() => {});
  }, [focus, allLoaded, visible]);

  const changeWarp = (w: number) => { warpRef.current = w; engine.current?.setWarp(w); setWarp(w); };
  const toggleSpin = () => setPaused(spin); // el motor escucha la preferencia guardada

  // Estado → URL (compartible). «g» siempre presente: vacío = ningún grupo (no los predeterminados)
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("g", selected.join(","));
    if (focus) p.set("sat", String(focus));
    if (`?${p}` === window.location.search) return;
    router.replace(`/satelites?${p}`, { scroll: false });
  }, [selected, focus, router, urlKey]);

  // Búsqueda en todo el catálogo
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      fetch(`/api/satellites?q=${encodeURIComponent(t)}`, { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((rows) => setResults({ q: t, rows }))
        .catch(() => { if (!ctrl.signal.aborted) setResults({ q: t, rows: null }); });
    }, 350);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [q]);

  const toggle = (g: string) => {
    setWarn(null);
    if (selected.includes(g)) setSelected(selected.filter((x) => x !== g));
    else if (selected.length >= MAX) setWarn(`Máximo ${MAX} grupos a la vez (uno por color).`);
    else setSelected([...selected, g]);
  };

  const addSat = async (norad: number) => {
    setQ(""); setResults(null); setWarn(null);
    if (!visible.some((v) => v.omm.NORAD_CAT_ID === norad)) {
      setAdding(norad);
      try {
        const r = await fetch(`/api/satellites/obj/${norad}`);
        if (!r.ok) { setWarn("No hay elementos orbitales públicos para ese objeto."); return; }
        const o: OMM = await r.json();
        setExtra((e) => [...e.filter((x) => x.NORAD_CAT_ID !== norad), o]);
      } catch {
        setWarn("No se pudo conectar con el catálogo. Inténtalo de nuevo.");
        return;
      } finally {
        setAdding(null);
      }
    }
    tried.current.add(norad);
    setFocus(norad);
  };

  const cats = Object.keys(categories) as GroupCategory[];
  const total = visible.length;
  const focusEntry = focus ? visible.find((v) => v.omm.NORAD_CAT_ID === focus) ?? null : null;
  const qt = q.trim();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-line bg-surface lg:h-[max(560px,calc(100dvh-150px))] lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Filtros */}
        <aside className="border-b border-line lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar satélite o NORAD…" aria-label="Buscar satélite"
                className="h-9 w-full rounded-md border border-line bg-bg pr-3 pl-8 text-[13px] placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
              {qt.length >= 3 && (
                <ul className="absolute inset-x-0 top-10 z-30 max-h-72 overflow-y-auto rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
                  {results?.q !== qt ? (
                    <li className="flex items-center gap-2 px-3 py-2 text-xs text-fg-dim"><Loader2 className="size-3.5 animate-spin" /> Buscando…</li>
                  ) : !results.rows ? (
                    <li className="px-3 py-2 text-xs text-fg-dim">La búsqueda no está disponible ahora mismo.</li>
                  ) : results.rows.length === 0 ? <li className="px-3 py-2 text-xs text-fg-dim">Sin resultados.</li> : results.rows.map((r) => (
                    <li key={r.norad}><button onClick={() => addSat(r.norad)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-3">
                      <span className="truncate">{r.name}</span><span className="num shrink-0 text-[11px] text-fg-dim">{r.norad}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {featured.map((x) => (
                <button key={x.norad} onClick={() => addSat(x.norad)} title={x.note} disabled={adding === x.norad}
                  className={clsx("inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] transition-colors", focus === x.norad ? "border-accent/60 text-fg" : "border-line text-fg-muted hover:text-fg")}>
                  {adding === x.norad && <Loader2 className="size-3 animate-spin" />}{x.name}
                </button>
              ))}
            </div>
          </div>
          {warn && <p className="border-b border-line px-3 py-2 text-xs text-tbc">{warn}</p>}
          <div className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-4 lg:overflow-visible">
            {cats.map((c) => (
              <div key={c} className="shrink-0 lg:shrink">
                <p className="label mb-1.5 hidden lg:block">{categories[c]}</p>
                <div className="flex gap-1.5 lg:flex-col lg:gap-0.5">
                  {groups.filter((g) => g.cat === c).map((g) => {
                    const on = selected.includes(g.key);
                    return (
                      <button key={g.key} onClick={() => toggle(g.key)} title={g.desc} aria-pressed={on}
                        className={clsx("flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors lg:w-full lg:border-transparent",
                          on ? "border-line-strong bg-surface-2 text-fg" : "border-line text-fg-muted hover:bg-surface-2 hover:text-fg")}>
                        <span className={clsx("flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors", on ? "border-transparent" : "border-line-strong")} style={on ? { background: colorOf(g.key) } : undefined}>
                          {on && <Check className="size-3 text-black" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap">{g.label}</span>
                        {isLoading(g.key) ? <Loader2 className="size-3.5 animate-spin text-fg-dim" /> : errors[g.key] ? <span className="text-[10px] text-failure" title={errors[g.key]}>!</span> : data[g.key] ? <span className="num text-[11px] text-fg-dim">{data[g.key].length.toLocaleString("es")}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Globo: barra de estado arriba (fuera del globo) + lienzo a pantalla completa */}
        <div className="flex min-h-0 flex-col">
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5 text-xs">
            <span className="num text-[13px] text-fg">{total.toLocaleString("es")} <span className="text-fg-muted">objetos · posiciones calculadas (SGP4)</span></span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
              {selected.map((g) => (
                <span key={g} className="flex items-center gap-1.5 whitespace-nowrap text-fg-muted"><span className="size-2 rounded-full" style={{ background: colorOf(g) }} />{groups.find((x) => x.key === g)?.label}</span>
              ))}
            </span>
            <button onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen}
              className={clsx("inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs", legendOpen ? "border-line-strong text-fg" : "border-line text-fg-muted hover:text-fg")}>
              <Info className="size-3.5" /> Leyenda
            </button>
            {legendOpen && (
              <div className="absolute top-full right-3 z-20 mt-1 grid w-64 grid-cols-1 gap-1.5 rounded-md border border-line-strong bg-surface-2 p-3 shadow-2xl">
                {(Object.keys(ICON_LABEL) as IconKind[]).map((k) => (
                  <span key={k} className="flex items-center gap-2 text-fg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {icons[k] && <img src={icons[k]} alt="" className="size-5" />}{ICON_LABEL[k]}
                  </span>
                ))}
                <p className="mt-1 border-t border-line pt-2 text-[10.5px] leading-snug text-fg-dim">El color indica el grupo; la forma, el tipo de objeto. Posiciones calculadas (SGP4 + velocidad) desde elementos orbitales de CelesTrak; la época de cada objeto figura en su ficha.</p>
              </div>
            )}
          </div>

          <div className="relative min-h-[420px] flex-1">
            <div ref={host} className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing" role="img" aria-label="Satélites seleccionados alrededor de la Tierra, posiciones calculadas" />
            {hover && <div className="pointer-events-none absolute z-10 rounded-md border border-line bg-bg/90 px-2 py-1 text-xs backdrop-blur" style={{ left: hover.x + 12, top: hover.y + 12 }}>{hover.name}</div>}
            {!focusEntry && total > 0 && <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] text-fg-dim sm:block">Arrastra para girar · rueda o pellizco para acercar · clic en un satélite para seguirlo</p>}
            <GlobeHint show={wheelHint} />

            {/* Controles de vista */}
            <div className="absolute top-3 right-3 flex flex-col gap-1">
              <CtlBtn label={spin ? "Pausar giro automático" : "Reanudar giro automático"} onClick={toggleSpin} active={spin}>{spin ? <Pause className="size-4" /> : <Play className="size-4" />}</CtlBtn>
              <CtlBtn label="Acercar" onClick={() => engine.current?.zoomBy(0.8)}><Plus className="size-4" /></CtlBtn>
              <CtlBtn label="Alejar" onClick={() => engine.current?.zoomBy(1.25)}><Minus className="size-4" /></CtlBtn>
              <CtlBtn label="Reencuadrar" onClick={() => engine.current?.resetView()}><Maximize2 className="size-4" /></CtlBtn>
            </div>

            {/* Reloj y velocidad del tiempo */}
            <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-bg/85 p-1 text-xs backdrop-blur">
              <span className={clsx("flex items-center gap-1.5 px-1.5", warp === 1 ? "text-go" : "text-tbc")}>
                {warp === 1 ? <><Clock className="size-3.5" /> Hora real</> : <>Tiempo ×{warp}</>}
                <SimClock engine={engine} />
              </span>
              <span className="flex rounded bg-surface-2 p-0.5">
                {[1, 10, 60, 600].map((w) => (
                  <button key={w} onClick={() => changeWarp(w)} aria-pressed={warp === w}
                    className={clsx("num rounded px-1.5 py-0.5 transition-colors", warp === w ? "bg-surface-3 text-fg" : "text-fg-dim hover:text-fg")}>×{w}</button>
                ))}
              </span>
            </div>

            {focusEntry && (
              <FocusCard key={focusEntry.omm.NORAD_CAT_ID} engine={engine} omm={focusEntry.omm}
                groupLabel={groups.find((g) => g.key === focusEntry.group)?.label ?? "Búsqueda"} onClose={() => setFocus(null)} />
            )}
          </div>
        </div>
      </div>

      {total > 0 && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted select-none hover:text-fg">Ver la lista de los {total.toLocaleString("es")} objetos visibles</summary>
          <SatTable objects={omms} />
        </details>
      )}
    </div>
  );
}

/** Reloj mostrado (hora real o simulada): se actualiza solo él, sin volver a pintar el explorador. */
function SimClock({ engine }: { engine: RefObject<SatEngine | null> }) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setT(engine.current?.time ?? null);
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [engine]);
  return t ? <span className="num text-fg-muted">{new Date(t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> : null;
}

/** Ficha del satélite seguido, con su estado calculado cada medio segundo. */
function FocusCard({ engine, omm, groupLabel, onClose }: { engine: RefObject<SatEngine | null>; omm: OMM; groupLabel: string; onClose: () => void }) {
  const [live, setLive] = useState<LiveInfo | null>(null);
  const norad = omm.NORAD_CAT_ID;
  useEffect(() => {
    const tick = () => setLive(engine.current?.live(norad) ?? null);
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [engine, norad, omm]);
  const f = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d });
  if (!live || live.norad !== norad) return null;
  return (
    <div className="animate-fade-in absolute right-3 bottom-3 left-3 rounded-lg border border-line-strong bg-bg/90 p-3.5 backdrop-blur md:left-auto md:w-72">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label mb-0.5 truncate">{groupLabel} · NORAD {norad}</p>
          <p className="truncate font-medium">{live.name}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar"><X className="size-4" /></button>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><p className="label">Latitud</p><p className="num">{f(live.lat, 3)}°</p></div>
        <div><p className="label">Longitud</p><p className="num">{f(live.lon, 3)}°</p></div>
        <div><p className="label">Altitud</p><p className="num">{f(live.alt, 1)} km</p></div>
        <div><p className="label">Velocidad</p><p className="num">{f(live.speed * 3600)} km/h</p></div>
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-fg-dim">{sgp4Note([omm])}</p>
      <Link href={`/satelites/${norad}`} className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
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
