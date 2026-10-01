"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import clsx from "clsx";
import { Plane, X, ExternalLink, Loader2, Search, Info, Rocket, ChevronDown } from "lucide-react";
import { neutralizeBasemap, MAP_LOCALE } from "./basemap";

const STYLE = process.env.NEXT_PUBLIC_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/dark";

export type AirPreset = { name: string; lat: number; lon: number; z: number; launch?: string };

type Track = {
  hex: string; cs: string | null; lon: number; lat: number; alt: number | null; gs: number | null; trk: number | null; vr: number | null; ground: boolean;
  tpos: number; country: string | null; type?: string | null; reg?: string | null; desc?: string | null; op?: string | null; sq?: string | null; em?: string | null;
  cat?: string | null; src: "global" | "live"; seen: number; trail: [number, number][];
};
type LiveAc = { hex: string; cs: string | null; reg: string | null; type: string | null; desc: string | null; op: string | null; lat: number; lon: number; alt: number | null; ground: boolean; gs: number | null; trk: number | null; vr: number | null; sq: string | null; em: string | null; cat: string | null; age: number };

const LIVE_MS = 5000;          // detalle de la zona visible (adsb.lol)
const GLOBAL_MS = 20_000;      // re-consulta de la instantánea mundial (la CDN devuelve la última disponible)
const LIVE_ZOOM = 5.5;         // desde este zoom se pide el detalle en vivo
const RADII = [25, 50, 100, 150, 250];
const snap = (v: number, step: number) => Math.round(v / step) * step;

// Navegación por estima: rumbo + velocidad respecto al suelo desde la última posición conocida
function project(lat: number, lon: number, trk: number, gsKt: number, sec: number): [number, number] {
  const d = (gsKt * 0.514444 * sec) / 6371000;
  const b = (trk * Math.PI) / 180, p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((((l2 * 180) / Math.PI) + 540) % 360) - 180, (p2 * 180) / Math.PI];
}
const posOf = (t: Track, now: number): [number, number] => {
  if (t.ground || !t.gs || t.trk == null) return [t.lon, t.lat];
  return project(t.lat, t.lon, t.trk, t.gs, Math.min(150, Math.max(0, (now - t.tpos) / 1000)));
};

function planeIcon(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.translate(size / 2, size / 2);
  g.scale(size / 64, size / 64);
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(0, -28); g.bezierCurveTo(3, -28, 4, -22, 4, -16); g.lineTo(4, -6); g.lineTo(28, 6); g.lineTo(28, 11); g.lineTo(4, 5);
  g.lineTo(3, 19); g.lineTo(11, 25); g.lineTo(11, 29); g.lineTo(0, 26); g.lineTo(-11, 29); g.lineTo(-11, 25); g.lineTo(-3, 19);
  g.lineTo(-4, 5); g.lineTo(-28, 11); g.lineTo(-28, 6); g.lineTo(-4, -6); g.lineTo(-4, -16); g.bezierCurveTo(-4, -22, -3, -28, 0, -28);
  g.fill();
  return g.getImageData(0, 0, size, size);
}

const nf = (v: number) => Math.round(v).toLocaleString("es");
// Rampa secuencial de un solo tono (oscuro → claro = bajo → alto)
const ALT_STOPS: [number, string][] = [[0, "#b8501f"], [10000, "#e2581c"], [20000, "#ff6a2e"], [30000, "#ff9363"], [40000, "#ffc4a3"]];

export function AirTraffic({ presets, initial }: { presets: AirPreset[]; initial: AirPreset }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const tracks = useRef(new Map<string, Track>());
  const [ready, setReady] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [globalAt, setGlobalAt] = useState<{ t: number; ttl: number } | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [selData, setSelData] = useState<Track | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [info, setInfo] = useState(false);
  const [region, setRegion] = useState(false);
  const selRef = useRef(sel);
  useEffect(() => { selRef.current = sel; }, [sel]);
  const kickLive = useRef<() => void>(() => {});

  // Mapa
  useEffect(() => {
    let map: MLMap | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, NavigationControl, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !el.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({ container: el.current, locale: MAP_LOCALE, style: STYLE, center: [initial.lon, initial.lat], zoom: initial.z, minZoom: 1.5, maxZoom: 14, attributionControl: false, renderWorldCopies: false });
      map.addControl(new NavigationControl({ showCompass: true }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true, customAttribution: "Tráfico: OpenSky Network · adsb.lol (ODbL)" }), "bottom-right");
      map.on("style.load", () => {
        const mm = map!;
        neutralizeBasemap(mm, ["air", "air-trail", "air-sel"]);
        if (!mm.hasImage("plane")) mm.addImage("plane", planeIcon(), { sdf: true, pixelRatio: 2 });
        mm.addSource("air", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        mm.addSource("trail", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        mm.addLayer({ id: "air-trail", type: "line", source: "trail", paint: { "line-color": "#ecebe6", "line-opacity": 0.6, "line-width": 1.6 } });
        mm.addLayer({
          id: "air", type: "symbol", source: "air",
          layout: {
            "icon-image": "plane", "icon-rotate": ["get", "trk"], "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true,
            "icon-size": ["interpolate", ["linear"], ["zoom"], 1.5, 0.2, 5, 0.36, 9, ["case", ["==", ["get", "heavy"], 1], 0.8, 0.62]],
            "text-field": ["step", ["zoom"], "", 8, ["get", "cs"]], "text-size": 10.5, "text-offset": [0, 1.5], "text-anchor": "top",
            "text-font": ["Noto Sans Regular", "Open Sans Regular"], "text-optional": true,
          },
          paint: {
            "icon-color": ["case", ["==", ["get", "ground"], 1], "#8f8b82", ["==", ["get", "em"], 1], "#ff4d4f", ["interpolate", ["linear"], ["get", "alt"], ...ALT_STOPS.flat()]],
            "icon-opacity": ["case", ["==", ["get", "sel"], 1], 1, ["==", ["get", "dim"], 1], 0.35, 0.95],
            "text-color": "#a6a39a", "text-halo-color": "#0b0b0a", "text-halo-width": 1.2,
          },
        });
        mm.addLayer({
          id: "air-sel", type: "circle", source: "air", filter: ["==", ["get", "sel"], 1],
          paint: { "circle-radius": 15, "circle-color": "transparent", "circle-stroke-color": "#ecebe6", "circle-stroke-width": 1.5 },
        });
        mm.on("click", "air", (e) => { const h = e.features?.[0]?.properties?.hex; if (h) setSel(String(h)); });
        mm.on("click", (e) => { if (!mm.queryRenderedFeatures(e.point, { layers: ["air"] }).length) setSel(null); });
        mm.on("mouseenter", "air", () => (mm.getCanvas().style.cursor = "pointer"));
        mm.on("mouseleave", "air", () => (mm.getCanvas().style.cursor = ""));
        setReady(true);
      });
      map.on("moveend", () => kickLive.current());
      // Créditos plegados por defecto (accesibles con el botón "i" del mapa)
      map.once("load", () => el.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
      mapRef.current = map;
    });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se crea una vez
  }, []);

  // Instantánea mundial: todos los aviones de una vez (no hace falta acercarse para verlos)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastT = 0;
    const load = async () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") { timer = setTimeout(load, GLOBAL_MS); return; }
      try {
        const res = await fetch("/api/air/global");
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        if (j.t !== lastT) {
          lastT = j.t;
          const now = Date.now();
          const tm = tracks.current;
          for (const a of j.ac as (string | number | null)[][]) {
            const hex = a[0] as string;
            const prev = tm.get(hex);
            // Lo que llegó en vivo hace poco es más preciso que la instantánea: se conserva
            if (prev?.src === "live" && now - prev.seen < 30_000) continue;
            const tpos = j.t - (a[9] as number) * 1000;
            const trail = prev?.trail ?? [];
            trail.push([a[2] as number, a[3] as number]);
            if (trail.length > 150) trail.shift();
            tm.set(hex, {
              ...prev, hex, cs: (a[1] as string) ?? prev?.cs ?? null, lon: a[2] as number, lat: a[3] as number, alt: a[4] as number | null, gs: a[5] as number | null,
              trk: a[6] as number | null, vr: a[7] as number | null, ground: a[8] === 1, tpos, country: j.countries[a[10] as number] ?? null, src: "global", seen: now, trail,
            });
          }
          // Fuera de la instantánea y sin datos en vivo recientes: aterrizó o salió de cobertura
          for (const [h, t] of tm) if (now - t.seen > Math.max(120_000, j.ttl * 1500)) tm.delete(h);
          setTotal(tm.size);
          setGlobalAt({ t: j.t, ttl: j.ttl });
          setErr(null);
        }
      } catch {
        setErr("No se pudo cargar el tráfico mundial. Reintentando…");
      } finally {
        setLoading(false);
        timer = setTimeout(load, GLOBAL_MS);
      }
    };
    load();
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // Detalle en vivo de la zona visible al acercarse (cada 5 s)
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    const poll = async () => {
      clearTimeout(timer);
      const map = mapRef.current;
      if (!map) return;
      if (document.visibilityState === "hidden" || map.getZoom() < LIVE_ZOOM) { setLiveOn(false); timer = setTimeout(poll, LIVE_MS); return; }
      const c = map.getCenter(), b = map.getBounds();
      const nm = Math.max(c.distanceTo(b.getNorthEast()), c.distanceTo(b.getSouthWest())) / 1852;
      const r = RADII.find((x) => x >= nm) ?? 250;
      const step = r <= 50 ? 0.1 : r <= 100 ? 0.25 : 0.5;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`/api/air?lat=${snap(c.lat, step).toFixed(2)}&lon=${snap(c.lng, step).toFixed(2)}&r=${r}`, { signal: ctrl.signal });
        const j = await res.json();
        if (res.ok) {
          const now = Date.now();
          const tm = tracks.current;
          for (const a of j.ac as LiveAc[]) {
            const prev = tm.get(a.hex);
            const trail = prev?.trail ?? [];
            const lastPt = trail[trail.length - 1];
            if (!lastPt || lastPt[0] !== a.lon || lastPt[1] !== a.lat) trail.push([a.lon, a.lat]);
            if (trail.length > 150) trail.shift();
            tm.set(a.hex, {
              hex: a.hex, cs: a.cs ?? prev?.cs ?? null, lon: a.lon, lat: a.lat, alt: a.alt, gs: a.gs, trk: a.trk, vr: a.vr, ground: a.ground,
              tpos: now - a.age * 1000, country: prev?.country ?? null, type: a.type, reg: a.reg, desc: a.desc, op: a.op, sq: a.sq, em: a.em, cat: a.cat,
              src: "live", seen: now, trail,
            });
          }
          setTotal(tm.size);
          setLiveOn(true);
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      } finally {
        timer = setTimeout(poll, LIVE_MS);
      }
    };
    kickLive.current = () => { clearTimeout(timer); timer = setTimeout(poll, 300); };
    poll();
    return () => { clearTimeout(timer); ctrl?.abort(); kickLive.current = () => {}; };
  }, [ready]);

  // Dibujo: solo lo visible (+ margen). Ritmo adaptativo: muchos aviones → 1 Hz (a esa escala el movimiento es subpíxel); pocos → 5 Hz
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = () => {
      const map = mapRef.current;
      const src = map?.getSource("air") as GeoJSONSource | undefined;
      let n = 0;
      if (map && src && document.visibilityState === "visible") {
        const now = Date.now();
        const b = map.getBounds();
        const padX = (b.getEast() - b.getWest()) * 0.15, padY = (b.getNorth() - b.getSouth()) * 0.15;
        const w = b.getWest() - padX, e = b.getEast() + padX, s = b.getSouth() - padY, nn = b.getNorth() + padY;
        const s0 = selRef.current;
        const feats: GeoJSON.Feature[] = [];
        for (const t of tracks.current.values()) {
          const [lon, lat] = posOf(t, now);
          if (lon < w || lon > e || lat < s || lat > nn) continue;
          feats.push({
            type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
            properties: { hex: t.hex, cs: t.cs ?? t.reg ?? "", trk: t.trk ?? 0, alt: t.alt ?? 0, ground: t.ground ? 1 : 0, em: t.em ? 1 : 0, heavy: t.cat === "A5" || t.cat === "A4" ? 1 : 0, sel: t.hex === s0 ? 1 : 0, dim: s0 && t.hex !== s0 ? 1 : 0 },
          });
        }
        n = feats.length;
        src.setData({ type: "FeatureCollection", features: feats });
        const st = s0 ? tracks.current.get(s0) : null;
        const line = st ? [...st.trail, posOf(st, now)] : [];
        (map.getSource("trail") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: line.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} }] : [] });
      }
      timer = setTimeout(frame, n > 2500 ? 1000 : n > 800 ? 400 : 200);
    };
    frame();
    const redraw = () => { clearTimeout(timer); frame(); };
    const map = mapRef.current;
    map?.on("moveend", redraw);
    return () => { clearTimeout(timer); map?.off("moveend", redraw); };
  }, [ready]);

  // Ficha del elegido
  useEffect(() => {
    if (!sel) return;
    const read = () => { const t = tracks.current.get(sel); setSelData(t ? { ...t } : null); };
    const t = setTimeout(read, 0);
    const iv = setInterval(read, 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [sel]);
  const shown = sel ? selData : null;

  // Búsqueda por indicativo, matrícula o código ICAO entre todos los aviones cargados
  useEffect(() => {
    const term = q.trim().toUpperCase().replace(/\s+/g, "");
    const t = setTimeout(() => {
      if (term.length < 2) { setResults([]); return; }
      const out: Track[] = [];
      for (const x of tracks.current.values()) {
        if ((x.cs && x.cs.replace(/\s+/g, "").startsWith(term)) || x.reg?.replace("-", "").startsWith(term.replace("-", "")) || x.hex.toUpperCase().startsWith(term)) out.push(x);
        if (out.length >= 8) break;
      }
      setResults(out);
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  const focusOn = (t: Track) => {
    const [lon, lat] = posOf(t, Date.now());
    setSel(t.hex);
    setQ("");
    setResults([]);
    mapRef.current?.flyTo({ center: [lon, lat], zoom: Math.max(mapRef.current.getZoom(), 7), speed: 1.6 });
  };
  const go = (p: AirPreset) => { setRegion(false); mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: p.z, speed: 1.6 }); };
  const legend = useMemo(() => `linear-gradient(90deg, ${ALT_STOPS.map(([, c], i) => `${c} ${(i / (ALT_STOPS.length - 1)) * 100}%`).join(", ")})`, []);
  const globalMin = globalAt ? Math.max(1, Math.round(globalAt.ttl / 60)) : null;

  return (
    <div className="relative h-[calc(100dvh-56px)] w-full overflow-hidden bg-bg">
      <div ref={el} className="h-full w-full" />

      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-bg/80 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 pr-1">
          <Plane className="size-4 text-accent" />
          <h1 className="text-sm font-semibold">Tráfico aéreo</h1>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            {loading ? <Loader2 className="size-3 animate-spin" /> : <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>}
            <span className="num text-fg">{total === null ? "—" : nf(total)}</span> aviones
          </span>
        </div>

        <div className="relative order-last w-full sm:order-none sm:w-auto sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && results[0] && focusOn(results[0])} placeholder="Buscar vuelo, matrícula o código ICAO…" aria-label="Buscar vuelo"
            className="h-8 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-[13px] placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-9 z-20 overflow-hidden rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
              {results.map((r) => (
                <li key={r.hex}>
                  <button onClick={() => focusOn(r)} className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-surface-3">
                    <span><span className="num font-medium">{r.cs ?? r.reg ?? r.hex.toUpperCase()}</span> <span className="text-xs text-fg-dim">{r.type ?? r.country ?? ""}</span></span>
                    <span className="num text-xs text-fg-muted">{r.ground ? "en tierra" : r.alt != null ? `${nf(r.alt)} ft` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button onClick={() => { setRegion((v) => !v); setInfo(false); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs text-fg-muted hover:text-fg" aria-expanded={region}>
              Ir a <ChevronDown className="size-3.5" />
            </button>
            {region && (
              <ul className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
                {presets.map((p) => (
                  <li key={p.name}>
                    <button onClick={() => go(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-3">
                      {p.launch ? <Rocket className="size-3.5 shrink-0 text-accent" /> : <span className="size-3.5 shrink-0" />}
                      <span className="min-w-0"><span className="block truncate">{p.name}</span>{p.launch && <span className="block truncate text-[11px] text-fg-dim">Lanzamiento: {p.launch}</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative">
            <button onClick={() => { setInfo((v) => !v); setRegion(false); }} className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-fg-muted hover:text-fg" aria-label="Sobre los datos" aria-expanded={info}><Info className="size-4" /></button>
            {info && (
              <div className="absolute right-0 top-9 z-20 w-72 rounded-md border border-line-strong bg-surface-2 p-3 text-xs leading-relaxed text-fg-muted shadow-2xl">
                <p><span className="text-fg">Vista mundial:</span> OpenSky Network{globalMin && `, renovada cada ~${globalMin} min`}{globalAt && ` (última: ${new Date(globalAt.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })})`}.</p>
                <p className="mt-1.5"><span className="text-fg">Al acercarte:</span> adsb.lol cada 5 s, con tipo y matrícula{liveOn && <span className="text-accent"> · activo</span>}.</p>
                <p className="mt-1.5">Entre actualizaciones cada avión avanza según su rumbo y velocidad. Datos de receptores ADS-B voluntarios: la cobertura varía por región.</p>
              </div>
            )}
          </div>
        </div>
        {err && <p className="w-full text-xs text-failure">{err}</p>}
      </div>

      {/* Leyenda */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-line bg-bg/80 px-2.5 py-1.5 backdrop-blur-md">
        <div className="h-1.5 w-40 rounded-full" style={{ background: legend }} />
        <div className="num mt-1 flex w-40 justify-between text-[9.5px] text-fg-dim"><span>0</span><span>20 000</span><span>40 000 ft</span></div>
      </div>

      {/* Ficha del avión: panel lateral (abajo en móvil), solo al elegir uno */}
      <aside
        className={clsx(
          "absolute z-10 overflow-hidden border-line bg-surface shadow-2xl transition-transform duration-300 ease-out",
          "inset-x-0 bottom-0 max-h-[55%] rounded-t-xl border-t sm:inset-x-auto sm:top-[49px] sm:bottom-0 sm:left-0 sm:max-h-none sm:w-80 sm:rounded-none sm:border-t-0 sm:border-r",
          shown ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:-translate-x-full",
        )}
        aria-hidden={!shown}
      >
        {shown && (
          <div className="h-full overflow-y-auto">
            <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="label">{[shown.type, shown.reg].filter(Boolean).join(" · ") || shown.country || "Aeronave"}</p>
                <h2 className="num truncate text-2xl font-semibold">{shown.cs ?? shown.reg ?? shown.hex.toUpperCase()}</h2>
                {(shown.desc || shown.op) && <p className="truncate text-xs text-fg-muted">{[shown.desc, shown.op].filter(Boolean).join(" · ")}</p>}
              </div>
              <button onClick={() => setSel(null)} className="rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar"><X className="size-4" /></button>
            </header>
            <dl className="grid grid-cols-2 gap-px bg-line text-sm">
              <div className="bg-surface p-3"><dt className="label">Altitud</dt><dd className="num mt-0.5 text-lg">{shown.ground ? "En tierra" : shown.alt == null ? "—" : `${nf(shown.alt)} ft`}</dd><dd className="num text-[11px] text-fg-dim">{!shown.ground && shown.alt != null ? `${nf(shown.alt * 0.3048)} m` : ""}</dd></div>
              <div className="bg-surface p-3"><dt className="label">Velocidad</dt><dd className="num mt-0.5 text-lg">{shown.gs == null ? "—" : `${nf(shown.gs)} kt`}</dd><dd className="num text-[11px] text-fg-dim">{shown.gs == null ? "" : `${nf(shown.gs * 1.852)} km/h`}</dd></div>
              <div className="bg-surface p-3"><dt className="label">Rumbo</dt><dd className="num mt-0.5 text-lg">{shown.trk == null ? "—" : `${Math.round(shown.trk)}°`}</dd></div>
              <div className="bg-surface p-3"><dt className="label">Vertical</dt><dd className="num mt-0.5 text-lg">{shown.vr == null ? "—" : `${shown.vr > 0 ? "+" : ""}${nf(shown.vr)}`}</dd><dd className="text-[11px] text-fg-dim">ft/min</dd></div>
            </dl>
            <dl className="divide-y divide-line text-sm">
              {([["País de registro", shown.country], ["Código ICAO", shown.hex.toUpperCase()], ["Squawk", shown.sq ? `${shown.sq}${shown.em ? " · emergencia" : ""}` : null], ["Fuente", shown.src === "live" ? "adsb.lol · en vivo (5 s)" : "OpenSky · instantánea mundial"]] as [string, string | null][])
                .filter(([, v]) => v)
                .map(([k, v]) => <div key={k} className="flex justify-between gap-3 px-4 py-2"><dt className="text-fg-muted">{k}</dt><dd className="num text-right">{v}</dd></div>)}
            </dl>
            <div className="flex gap-2 px-4 py-3">
              <a href={`https://globe.adsb.lol/?icao=${shown.hex}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs hover:bg-surface-2">Historial del vuelo <ExternalLink className="size-3" /></a>
            </div>
            {shown.src !== "live" && <p className="px-4 pb-3 text-[11px] text-fg-dim">Acércate a la zona para ver tipo, matrícula y posición cada 5 s.</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
