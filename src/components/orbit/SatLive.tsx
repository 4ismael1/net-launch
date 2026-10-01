"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { Crosshair, Eye, EyeOff, LocateFixed, Sun, Moon } from "lucide-react";
import clsx from "clsx";
import {
  json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, jday, sunPos, shadowFraction, type SatRec,
} from "@/lib/sgp4";
import type { OMM } from "@/lib/orbit";
import { computePasses, dir, type Pass } from "@/lib/passes";
import { neutralizeBasemap, MAP_LOCALE } from "@/components/map/basemap";
import { sgp4Note } from "./orbitMeta";

const STYLE = process.env.NEXT_PUBLIC_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/dark";

type State = { t: number; lat: number; lon: number; alt: number; speed: number; sunlit: boolean };

function stateAt(rec: SatRec, d: Date): State | null {
  const pv = propagate(rec, d);
  if (!pv?.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
  const g = gstime(d);
  const geo = eciToGeodetic(pv.position, g);
  const sunlit = shadowFraction(sunPos(jday(d)).rsun, pv.position) < 0.5;
  const v = pv.velocity;
  return { t: d.getTime(), lat: degreesLat(geo.latitude), lon: degreesLong(geo.longitude), alt: geo.height, speed: Math.hypot(v.x, v.y, v.z), sunlit };
}

/** Traza sobre el suelo partida en el antimeridiano. */
function groundTrack(rec: SatRec, from: Date, minutes: number, stepS = 30) {
  const lines: [number, number][][] = [[]];
  let prev: number | null = null;
  for (let t = 0; t <= minutes * 60; t += stepS) {
    const s = stateAt(rec, new Date(from.getTime() + t * 1000));
    if (!s) continue;
    if (prev !== null && Math.abs(s.lon - prev) > 180) lines.push([]);
    lines[lines.length - 1].push([s.lon, s.lat]);
    prev = s.lon;
  }
  return lines.filter((l) => l.length > 1);
}

const toFC = (ls: [number, number][][]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: ls.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) });
const pointFC = (p: { lat: number; lon: number } | null): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection", features: p ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }] : [],
});

export function SatLive({ omm }: { omm: OMM }) {
  const rec = useMemo(() => json2satrec(omm as never) as SatRec, [omm]);
  const [s, setS] = useState<State | null>(null);
  const [obs, setObs] = useState<{ lat: number; lon: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const sRef = useRef<State | null>(null);
  const obsRef = useRef<{ lat: number; lon: number } | null>(null);
  const periodMin = 1440 / omm.MEAN_MOTION;
  // Recorrido anterior (1/3) y próximas órbitas (1,5 vueltas) desde ahora
  const tracks = useCallback(() => {
    const now = Date.now(), span = Math.min(Math.max(periodMin * 1.5, 100), 1440);
    return [toFC(groundTrack(rec, new Date(now - (span / 3) * 60_000), span / 3)), toFC(groundTrack(rec, new Date(now), span))] as const;
  }, [rec, periodMin]);

  // Estado cada segundo
  useEffect(() => {
    const tick = () => setS(stateAt(rec, new Date()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [rec]);

  // Mapa con traza
  useEffect(() => {
    let map: MLMap | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !mapEl.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({ container: mapEl.current, locale: MAP_LOCALE, style: STYLE, center: [0, 15], zoom: 0.6, minZoom: 0, attributionControl: false, renderWorldCopies: false, cooperativeGestures: true });
      map.addControl(new AttributionControl({ compact: true }), "bottom-left");
      map.on("style.load", () => {
        const m = map!;
        neutralizeBasemap(m, ["past", "future", "sat-halo", "sat", "obs"]);
        const [past, future] = tracks();
        m.addSource("past", { type: "geojson", data: past });
        m.addSource("future", { type: "geojson", data: future });
        // Al recrearse el mapa (volver a la página) se pintan ya el satélite y el observador conocidos
        m.addSource("sat", { type: "geojson", data: pointFC(sRef.current) });
        m.addSource("obs", { type: "geojson", data: pointFC(obsRef.current) });
        m.addLayer({ id: "past", type: "line", source: "past", paint: { "line-color": "#8f8b82", "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.7 } });
        m.addLayer({ id: "future", type: "line", source: "future", paint: { "line-color": "#ff5b1f", "line-width": 1.6, "line-opacity": 0.85 } });
        m.addLayer({ id: "sat-halo", type: "circle", source: "sat", paint: { "circle-color": "#ff5b1f", "circle-radius": 12, "circle-opacity": 0.2 } });
        m.addLayer({ id: "sat", type: "circle", source: "sat", paint: { "circle-color": "#ffffff", "circle-radius": 4.5, "circle-stroke-width": 2, "circle-stroke-color": "#ff5b1f" } });
        m.addLayer({ id: "obs", type: "circle", source: "obs", paint: { "circle-color": "#f5b83d", "circle-radius": 5, "circle-stroke-width": 2, "circle-stroke-color": "#0b0b0a" } });
        m.fitBounds([[-170, -65], [178, 75]], { padding: 6, animate: false });
      });
      mapRef.current = map;
    });
    // La traza se renueva cada 10 min: con la página abierta horas, el satélite nunca se sale del tramo dibujado
    const iv = setInterval(() => {
      const m = mapRef.current;
      if (!m?.getSource("past")) return;
      const [past, future] = tracks();
      (m.getSource("past") as GeoJSONSource).setData(past);
      (m.getSource("future") as GeoJSONSource).setData(future);
    }, 10 * 60_000);
    return () => { cancelled = true; clearInterval(iv); map?.remove(); mapRef.current = null; };
  }, [tracks]);

  useEffect(() => {
    sRef.current = s;
    (mapRef.current?.getSource("sat") as GeoJSONSource | undefined)?.setData(pointFC(s));
  }, [s]);
  useEffect(() => {
    obsRef.current = obs;
    (mapRef.current?.getSource("obs") as GeoJSONSource | undefined)?.setData(pointFC(obs));
  }, [obs]);

  // Pasos: se calculan al conocer la ubicación y se renuevan cada 10 min (los ya terminados desaparecen)
  useEffect(() => {
    if (!obs) return;
    const run = () => setPasses(computePasses(rec, obs));
    const first = setTimeout(run, 10);
    const iv = setInterval(run, 10 * 60_000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [rec, obs]);

  const locate = () => {
    setGeoErr(null);
    if (!navigator.geolocation) { setGeoErr("Tu navegador no permite obtener la ubicación."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        // Redondeo a ~1 km: suficiente para los pasos y más privado. No se envía a ningún servidor.
        const o = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 };
        setObs(o);
      },
      () => setGeoErr("No se pudo obtener tu ubicación (permiso denegado o no disponible)."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const f = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d });
  const tf = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const hf = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-5">
        <Cell k="Latitud" v={s ? `${f(s.lat, 2)}°` : "—"} />
        <Cell k="Longitud" v={s ? `${f(s.lon, 2)}°` : "—"} />
        <Cell k="Altitud" v={s ? `${f(s.alt)} km` : "—"} />
        <Cell k="Velocidad" v={s ? `${f(s.speed, 2)} km/s` : "—"} hint={s ? `${f(s.speed * 3600)} km/h` : undefined} />
        <Cell k="Iluminación" v={s ? (s.sunlit ? "Al sol" : "En sombra") : "—"} icon={s ? (s.sunlit ? Sun : Moon) : undefined} />
      </div>
      <p className="-mt-2 text-[11px] text-fg-dim" suppressHydrationWarning>{sgp4Note([omm])}. No es telemetría en vivo.</p>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="label !text-fg-muted">Traza sobre la Tierra</h2>
          <span className="flex gap-4 text-[11px] text-fg-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> Próximas órbitas</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-[#8f8b82]" /> Recorrido anterior</span>
          </span>
        </header>
        <div ref={mapEl} className="h-[360px] w-full bg-bg" role="img" aria-label="Traza del satélite sobre el mapa" />
      </section>

      <section className="rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="label !text-fg-muted">¿Cuándo pasa sobre mí?</h2>
          <button onClick={locate} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs hover:bg-surface-2">
            <LocateFixed className="size-3.5" /> {obs ? "Actualizar ubicación" : "Usar mi ubicación"}
          </button>
        </header>
        {geoErr && <p className="px-4 py-3 text-sm text-failure">{geoErr}</p>}
        {!obs && !geoErr && (
          <p className="px-4 py-6 text-sm text-fg-muted">
            Calcula los próximos pasos (72 h, elevación &gt; 10°) sobre tu posición. El cálculo se hace en tu navegador: tu ubicación no se envía a ningún servidor.
          </p>
        )}
        {obs && passes && (passes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">No hay pasos por encima de 10° en las próximas 72 horas para tu ubicación.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-surface-2 text-left"><tr>
                {["Inicio", "Punto más alto", "Fin", "Elevación máx.", "Dirección", "A simple vista"].map((h) => <th key={h} className="label px-4 py-2 font-normal">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {passes.map((p) => (
                  <tr key={p.start.toISOString()} className={clsx(p.visible && "bg-accent-soft")}>
                    <td className="num px-4 py-2">{tf.format(p.start)}{s && p.start.getTime() <= s.t && <span className="ml-1.5 text-[11px] text-accent">en curso</span>}</td>
                    <td className="num px-4 py-2 text-fg-muted">{hf.format(p.peak)}</td>
                    <td className="num px-4 py-2 text-fg-muted">{hf.format(p.end)}</td>
                    <td className="num px-4 py-2">{f(p.maxEl)}°</td>
                    <td className="num px-4 py-2 text-fg-muted">{dir(p.azStart)} → {dir(p.azEnd)}</td>
                    <td className="px-4 py-2">{p.visible ? <span className="inline-flex items-center gap-1.5 text-accent"><Eye className="size-4" /> Posible</span> : <span className="inline-flex items-center gap-1.5 text-fg-dim"><EyeOff className="size-4" /> No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">
              <Crosshair className="mr-1 inline size-3" />
              «Posible» = el satélite está iluminado por el Sol y en tu cielo ya es de noche (Sol &lt; −6°). El brillo real depende del tamaño del objeto, nubes y contaminación lumínica.
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Cell({ k, v, hint, icon: Icon }: { k: string; v: string; hint?: string; icon?: typeof Sun }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="label">{k}</p>
      <p className="num mt-1 flex items-center gap-1.5 text-lg">{Icon && <Icon className="size-4 text-fg-muted" />}{v}</p>
      {hint && <p className="num text-[11px] text-fg-dim">{hint}</p>}
    </div>
  );
}
