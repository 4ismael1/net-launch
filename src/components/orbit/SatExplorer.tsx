"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowUpRight, Check, Loader2, Search, X } from "lucide-react";
import type { OMM } from "@/lib/orbit";
import type { GroupCategory } from "@/lib/satellites";
import { SatEngine, type LiveInfo } from "./SatEngine";
import { ICON_LABEL, iconDataUrl, iconFor, type IconKind } from "./satIcons";
import { SatTable } from "./SatTable";

export type GroupMeta = { key: string; label: string; cat: GroupCategory; desc: string };

// Paleta categórica fija (validada para daltonismo sobre grafito). Máx. 8 grupos a la vez: nunca se repiten colores.
const PALETTE = ["#ff5b1f", "#3fb6c9", "#f5b83d", "#e46fa7", "#b5d25f", "#ecebe6", "#4f8fea", "#c9785d"];
const MAX = PALETTE.length;
const EXTRA = "__extra";

export function SatExplorer({ groups, categories, featured }: {
  groups: GroupMeta[];
  categories: Record<GroupCategory, string>;
  featured: { norad: number; name: string; note: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SatEngine | null>(null);

  const initial = (sp.get("g") ?? "stations,gps-ops").split(",").filter((g) => groups.some((x) => x.key === g)).slice(0, MAX);
  const [selected, setSelected] = useState<string[]>(initial);
  const [data, setData] = useState<Record<string, OMM[]>>({});
  const inflight = useRef(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<OMM[]>([]); // añadidos desde la búsqueda
  const [focus, setFocus] = useState<number | null>(sp.get("sat") ? Number(sp.get("sat")) : null);
  const [live, setLive] = useState<LiveInfo | null>(null);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ norad: number; name: string; id: string }[] | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [icons, setIcons] = useState<Partial<Record<IconKind, string>>>({});

  const colorOf = (g: string) => (g === EXTRA ? "#ffffff" : PALETTE[selected.indexOf(g)] ?? "#8f8b82");

  // Motor 3D
  useEffect(() => {
    if (!host.current) return;
    const e = new SatEngine(host.current);
    e.onPick = (n) => setFocus(n);
    e.onHover = (name, x, y) => setHover(name ? { name, x, y } : null);
    engine.current = e;
    setIcons(Object.fromEntries((Object.keys(ICON_LABEL) as IconKind[]).map((k) => [k, iconDataUrl(k, 16)])));
    return () => { e.dispose(); engine.current = null; };
  }, []);

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

  // Conjunto visible → motor
  const visible = useMemo(() => {
    const seen = new Set<number>();
    const out: { omm: OMM; group: string }[] = [];
    for (const g of selected) for (const o of data[g] ?? []) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); out.push({ omm: o, group: g }); }
    for (const o of extra) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); out.push({ omm: o, group: EXTRA }); }
    return out;
  }, [selected, data, extra]);

  useEffect(() => {
    engine.current?.setSatellites(
      visible.map((v) => ({ ...v, color: colorOf(v.group), icon: iconFor(v.group, v.omm.OBJECT_NAME) })),
      focus,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => { engine.current?.selectNorad(focus); }, [focus]);

  // Datos en vivo del seleccionado
  useEffect(() => {
    if (!focus) return;
    const tick = () => setLive(engine.current?.live(focus) ?? null);
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [focus, visible]);

  // URL compartible
  useEffect(() => {
    const p = new URLSearchParams();
    if (selected.length) p.set("g", selected.join(","));
    if (focus) p.set("sat", String(focus));
    router.replace(`/satelites?${p}`, { scroll: false });
  }, [selected, focus, router]);

  // Búsqueda en todo el catálogo
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const ctrl = new AbortController();
    const h = setTimeout(() => fetch(`/api/satellites?q=${encodeURIComponent(t)}`, { signal: ctrl.signal }).then((r) => r.json()).then(setResults).catch(() => {}), 350);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [q]);

  const toggle = (g: string) => {
    setWarn(null);
    setSelected((s) => {
      if (s.includes(g)) return s.filter((x) => x !== g);
      if (s.length >= MAX) { setWarn(`Máximo ${MAX} grupos a la vez (uno por color).`); return s; }
      return [...s, g];
    });
  };

  const addSat = async (norad: number) => {
    setQ(""); setResults(null);
    if (!visible.some((v) => v.omm.NORAD_CAT_ID === norad)) {
      const r = await fetch(`/api/satellites/obj/${norad}`);
      if (!r.ok) { setWarn("No hay elementos orbitales públicos para ese objeto."); return; }
      const o: OMM = await r.json();
      setExtra((e) => [...e.filter((x) => x.NORAD_CAT_ID !== norad), o]);
    }
    setFocus(norad);
  };

  const cats = Object.keys(categories) as GroupCategory[];
  const total = visible.length;
  const shown = focus && live?.norad === focus ? live : null;
  const focusGroup = shown ? groups.find((g) => g.key === shown.group)?.label ?? "Búsqueda" : null;
  const f = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Filtros */}
        <aside className="border-b border-line lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar satélite o NORAD…"
                className="h-9 w-full rounded-md border border-line bg-bg pr-3 pl-8 text-[13px] placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
              {q.trim().length >= 3 && results && (
                <ul className="absolute inset-x-0 top-10 z-30 max-h-72 overflow-y-auto rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
                  {results.length === 0 ? <li className="px-3 py-2 text-xs text-fg-dim">Sin resultados.</li> : results.map((r) => (
                    <li key={r.norad}><button onClick={() => addSat(r.norad)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-3">
                      <span className="truncate">{r.name}</span><span className="num shrink-0 text-[11px] text-fg-dim">{r.norad}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {featured.map((x) => (
                <button key={x.norad} onClick={() => addSat(x.norad)} title={x.note}
                  className={clsx("rounded-sm border px-2 py-0.5 text-[11px]", focus === x.norad ? "border-accent/60 text-fg" : "border-line text-fg-muted hover:text-fg")}>{x.name}</button>
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
                        <span className={clsx("flex size-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-transparent" : "border-line-strong")} style={on ? { background: colorOf(g.key) } : undefined}>
                          {on && <Check className="size-3 text-black" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap">{g.label}</span>
                        {isLoading(g.key) ? <Loader2 className="size-3.5 animate-spin text-fg-dim" /> : errors[g.key] ? <span className="text-[10px] text-failure">!</span> : data[g.key] ? <span className="num text-[11px] text-fg-dim">{data[g.key].length.toLocaleString("es")}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Globo */}
        <div className="relative min-h-[520px] lg:h-[calc(100dvh-140px)]">
          <div ref={host} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" role="img" aria-label="Satélites seleccionados alrededor de la Tierra, en tiempo real" />
          {hover && <div className="pointer-events-none absolute z-10 rounded-md border border-line bg-bg/90 px-2 py-1 text-xs backdrop-blur" style={{ left: hover.x + 12, top: hover.y + 12 }}>{hover.name}</div>}

          <div className="pointer-events-none absolute top-3 left-3 max-w-[70%] rounded-md border border-line bg-bg/80 p-2.5 text-[11px] backdrop-blur">
            <p className="num text-[13px] text-fg">{total.toLocaleString("es")} objetos en tiempo real</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {selected.map((g) => (
                <span key={g} className="flex items-center gap-1.5 text-fg-muted"><span className="size-2 rounded-full" style={{ background: colorOf(g) }} />{groups.find((x) => x.key === g)?.label}</span>
              ))}
            </div>
            <div className="mt-2 hidden flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 md:flex">
              {(Object.keys(ICON_LABEL) as IconKind[]).map((k) => icons[k] && (
                // eslint-disable-next-line @next/next/no-img-element
                <span key={k} className="flex items-center gap-1 text-fg-dim"><img src={icons[k]} alt="" className="size-3.5 opacity-80" />{ICON_LABEL[k]}</span>
              ))}
            </div>
          </div>

          {shown && (
            <div className="absolute right-3 bottom-3 left-3 rounded-lg border border-line-strong bg-bg/90 p-4 backdrop-blur md:left-auto md:w-80">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="label mb-0.5">{focusGroup} · NORAD {shown.norad}</p>
                  <p className="truncate font-medium">{shown.name}</p>
                </div>
                <button onClick={() => setFocus(null)} className="rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar"><X className="size-4" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><p className="label">Latitud</p><p className="num">{f(shown.lat, 3)}°</p></div>
                <div><p className="label">Longitud</p><p className="num">{f(shown.lon, 3)}°</p></div>
                <div><p className="label">Altitud</p><p className="num">{f(shown.alt, 1)} km</p></div>
                <div><p className="label">Velocidad</p><p className="num">{f(shown.speed * 3600)} km/h</p></div>
              </div>
              <Link href={`/satelites/${shown.norad}`} className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                Ficha completa, traza y pasos sobre ti <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
          <p className="pointer-events-none absolute right-3 bottom-3 hidden max-w-xs text-right text-[10.5px] text-fg-dim md:block" style={{ display: shown ? "none" : undefined }}>
            Posiciones calculadas en tiempo real (SGP4 + velocidad) con elementos de CelesTrak. Clic en un satélite para seguirlo.
          </p>
        </div>
      </div>

      {total > 0 && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted select-none hover:text-fg">Ver la lista de los {total.toLocaleString("es")} objetos visibles</summary>
          <SatTable objects={visible.map((v) => v.omm)} />
        </details>
      )}
    </div>
  );
}
