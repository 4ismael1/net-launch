"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { Anchor, Plus, Minus, Maximize } from "lucide-react";
import { neutralizeBasemap, MAP_LOCALE } from "./basemap";

export type Zone = {
  id: number; name: string; abbrev: string | null; place: string | null; ok: number; attempts: number; fail: number;
  lat: number | null; lng: number | null;
  next: { slug: string; name: string; net: string } | null; // próximo vuelo que aterrizará aquí
};

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE = KEY ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${KEY}` : "https://tiles.openfreemap.org/styles/dark";
const OWN = ["z-halo", "z", "z-sel", "z-label"];

const fc = (zones: Zone[], sel: number | null): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: zones.filter((z) => z.lat != null && z.lng != null).map((z) => ({
    type: "Feature", id: z.id,
    geometry: { type: "Point", coordinates: [z.lng!, z.lat!] },
    properties: { id: z.id, label: z.abbrev ?? z.name, n: z.attempts, up: z.next ? 1 : 0, sel: z.id === sel ? 1 : 0 },
  })),
});

/** Zonas de aterrizaje: mapa interactivo (zoom, arrastre, clic) sincronizado con la lista. */
export function LandingZonesMap({ zones }: { zones: Zone[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const zonesRef = useRef(zones);
  const listRef = useRef<HTMLUListElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const selRef = useRef<number | null>(null);
  useEffect(() => { zonesRef.current = zones; selRef.current = sel; });

  const onMap = zones.filter((z) => z.lat != null && z.lng != null);
  const atSea = zones.filter((z) => z.lat == null || z.lng == null);

  const fitAll = (m: MLMap, animate = true) => {
    const pts = zonesRef.current.filter((z) => z.lat != null && z.lng != null);
    if (!pts.length) return;
    const lng = pts.map((z) => z.lng!), lat = pts.map((z) => z.lat!);
    m.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], { padding: 56, maxZoom: 6, animate, duration: 700 });
  };

  useEffect(() => {
    let map: MLMap | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !el.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: el.current, locale: MAP_LOCALE, style: STYLE, center: [-95, 32], zoom: 2.4, minZoom: 1, maxZoom: 14,
        attributionControl: false, renderWorldCopies: false, cooperativeGestures: false, dragRotate: false, pitchWithRotate: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");
      map.on("style.load", () => {
        const m = map!;
        if (!KEY) neutralizeBasemap(m, OWN);
        m.addSource("z", { type: "geojson", data: fc(zonesRef.current, selRef.current) });
        const color = ["case", ["==", ["get", "up"], 1], "#ff5b1f", "#d8d5cc"] as unknown as string;
        const r = ["interpolate", ["linear"], ["sqrt", ["get", "n"]], 1, 5, 16, 16] as unknown as number;
        m.addLayer({ id: "z-halo", type: "circle", source: "z", paint: { "circle-color": color, "circle-opacity": 0.16, "circle-radius": ["*", r, 1.9] as unknown as number, "circle-blur": 0.35 } });
        m.addLayer({ id: "z", type: "circle", source: "z", paint: { "circle-color": color, "circle-opacity": 0.9, "circle-radius": ["*", r, 0.55] as unknown as number, "circle-stroke-width": 1.5, "circle-stroke-color": "#0b0b0a" } });
        m.addLayer({ id: "z-sel", type: "circle", source: "z", filter: ["==", ["get", "sel"], 1], paint: { "circle-color": "transparent", "circle-radius": ["*", r, 1.25] as unknown as number, "circle-stroke-width": 2, "circle-stroke-color": "#ff5b1f" } });
        // Etiquetas con detección de colisiones: las que se pisan se ocultan hasta acercar (la seleccionada siempre)
        m.addLayer({
          id: "z-label", type: "symbol", source: "z",
          layout: {
            "text-field": ["get", "label"], "text-font": ["Noto Sans Bold", "Open Sans Bold"], "text-size": 12,
            "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 1.1, "text-justify": "auto",
            "symbol-sort-key": ["-", 0, ["+", ["*", ["get", "sel"], 1000], ["get", "n"]]] as unknown as number,
            "text-padding": 3,
          },
          paint: { "text-color": ["case", ["==", ["get", "sel"], 1], "#ff5b1f", "#ecebe6"] as unknown as string, "text-halo-color": "#0b0b0a", "text-halo-width": 1.6 },
        });
        // Un solo manejador para las capas apiladas (si no, un clic las dispararía varias veces)
        const hit = ["z", "z-halo", "z-label"];
        m.on("mousemove", hit, (e) => { m.getCanvas().style.cursor = "pointer"; setHover(Number(e.features?.[0]?.properties?.id) || null); });
        m.on("mouseleave", hit, () => { m.getCanvas().style.cursor = ""; setHover(null); });
        m.on("click", hit, (e) => { e.preventDefault(); const zid = Number(e.features?.[0]?.properties?.id); if (zid) setSel((s) => (s === zid ? null : zid)); });
        // Clic en el vacío: deselecciona
        m.on("click", (e) => { if (!e.defaultPrevented) setSel(null); });
        fitAll(m, false);
      });
      map.once("load", () => el.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
    });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
  }, []);

  // Datos y selección → mapa; al seleccionar, vuela a la zona
  useEffect(() => {
    const m = mapRef.current;
    const src = m?.getSource("z") as GeoJSONSource | undefined;
    src?.setData(fc(zones, sel));
    const z = zones.find((x) => x.id === sel);
    if (m && z?.lat != null && z.lng != null) m.flyTo({ center: [z.lng, z.lat], zoom: Math.max(m.getZoom(), 6.5), speed: 1.4, essential: true });
    if (sel != null) listRef.current?.querySelector<HTMLElement>(`[data-zone="${sel}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [zones, sel]);

  // Enlaces #zona-<id> (p. ej. desde las tarjetas de propulsores): selecciona la zona y desplaza hasta el mapa
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const go = () => {
      const m = /^#zona-(\d+)$/.exec(location.hash);
      if (!m) return;
      const id = Number(m[1]);
      if (!zonesRef.current.some((z) => z.id === id)) return;
      setSel(id);
      rootRef.current?.closest("section")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", location.pathname + location.search); // un segundo clic en la misma tarjeta vuelve a funcionar
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  const zoomBy = (d: number) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + d, duration: 250 });
  const selected = zones.find((z) => z.id === sel) ?? null;

  return (
    <div ref={rootRef} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="relative flex min-h-[340px] flex-col border-b border-line lg:min-h-[440px] lg:border-r lg:border-b-0">
        {/* MapLibre impone position:relative al contenedor: la altura viene del flujo (flex-1) */}
        <div ref={el} className="min-h-[340px] w-full flex-1 bg-bg lg:min-h-[440px]" role="region" aria-label="Mapa interactivo de zonas de aterrizaje" />
        <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-md border border-line bg-bg/80 backdrop-blur">
          <button type="button" onClick={() => zoomBy(1)} className="grid size-8 place-items-center text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Acercar"><Plus className="size-4" /></button>
          <button type="button" onClick={() => zoomBy(-1)} className="grid size-8 place-items-center border-t border-line text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Alejar"><Minus className="size-4" /></button>
          <button type="button" onClick={() => { setSel(null); if (mapRef.current) fitAll(mapRef.current); }} className="grid size-8 place-items-center border-t border-line text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Ver todas las zonas"><Maximize className="size-3.5" /></button>
        </div>
        {selected && (
          <div key={selected.id} className="absolute right-12 bottom-3 left-3 animate-pop-in rounded-md border border-line-strong bg-surface-2/95 p-3 text-sm shadow-2xl backdrop-blur sm:right-auto sm:max-w-80">
            <p className="font-medium"><span className="text-accent">{selected.abbrev ?? selected.name}</span> {selected.abbrev && <span className="text-fg-muted">{selected.name}</span>}</p>
            {selected.place && <p className="mt-0.5 text-xs text-fg-dim">{selected.place}</p>}
            <p className="num mt-2 text-xs text-fg-muted">{selected.ok} aterrizajes logrados de {selected.attempts} intentos{selected.fail > 0 ? ` · ${selected.fail} ${selected.fail === 1 ? "fallido" : "fallidos"}` : ""}</p>
            {selected.next && <p className="mt-1 text-xs text-fg-muted">Próximo: <Link href={`/lanzamientos/${selected.next.slug}`} className="text-fg underline-offset-2 hover:underline">{selected.next.name}</Link></p>}
          </div>
        )}
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 rounded-md border border-line bg-bg/85 px-2.5 py-1.5 text-[11px] text-fg-muted backdrop-blur">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Próximos vuelos</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#d8d5cc]" /> Tamaño = intentos</span>
        </div>
      </div>

      <ul ref={listRef} className="grid max-h-[440px] content-start gap-1 overflow-y-auto p-2">
        {zones.map((z) => {
          const active = z.id === sel, hov = z.id === hover;
          const sea = z.lat == null || z.lng == null;
          return (
            <li key={z.id} data-zone={z.id}>
              <button type="button" onClick={() => setSel(active ? null : z.id)} aria-pressed={active}
                onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)}
                className={clsx("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  active ? "bg-surface-3" : hov ? "bg-surface-2" : "hover:bg-surface-2")}>
                <span className="flex min-w-0 items-baseline gap-1.5">
                  {z.next && <span className="size-1.5 shrink-0 -translate-y-0.5 rounded-full bg-accent" aria-label="Con próximos vuelos" />}
                  <span className={clsx("shrink-0 font-medium", active && "text-accent")}>{z.abbrev ?? z.name}</span>
                  {z.abbrev && <span className="truncate text-xs text-fg-dim">{z.name}</span>}
                  {sea && <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-fg-dim"><Anchor className="size-3" /> en el mar</span>}
                </span>
                <span className="num text-xs text-fg-muted">{z.ok}/{z.attempts}</span>
                <span className="col-span-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                  <span className="h-full rounded-l-full bg-fg-muted/70" style={{ width: `${(z.ok / z.attempts) * 100}%` }} />
                  {z.attempts > z.ok && <span className="h-full rounded-r-full bg-failure" style={{ width: `${((z.attempts - z.ok) / z.attempts) * 100}%` }} />}
                </span>
              </button>
            </li>
          );
        })}
        {atSea.length > 0 && onMap.length > 0 && (
          <li className="px-2.5 pt-2 pb-1 text-[11px] leading-relaxed text-fg-dim">Las zonas en el mar ({atSea.map((z) => z.abbrev ?? z.name).join(", ")}: barcazas autónomas y amerizajes) no tienen posición fija, por eso no se dibujan en el mapa.</li>
        )}
      </ul>
    </div>
  );
}
