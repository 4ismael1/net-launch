"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Maximize2, Minus, Pause, Play, Plus } from "lucide-react";
import { orbitControls, orbitPath, screenScale } from "./earth";
import { drawIcon, iconFor, type IconKind } from "./satIcons";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, type SatRec } from "@/lib/sgp4";
import type { OMM } from "@/lib/orbit";

const RE = 6371;
const COLORS = ["#ff5b1f", "#ecebe6", "#f5b83d", "#a6a39a", "#c9785d", "#ffb08c"];

/** ECI (km) → coordenadas three (Y arriba). */
const eci = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x / RE, p.z / RE, -p.y / RE);
/** lon/lat (°) sobre la esfera, en marco fijo a la Tierra. */
const ll = (lon: number, lat: number, r = 1.001) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

type Live = { name: string; lat: number; lon: number; alt: number; color: string };

/**
 * Visor orbital. Las posiciones se CALCULAN con SGP4 a partir de los elementos orbitales publicados (no es telemetría).
 */
export function OrbitViewer({ objects, height = 460 }: { objects: OMM[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<Live[]>([]);
  const ctlRef = useRef<ReturnType<typeof orbitControls> | null>(null);
  const [spin, setSpin] = useState(true);
  function control(kind: "spin" | "in" | "out" | "reset") {
    const c = ctlRef.current;
    if (!c) return;
    if (kind === "spin") { c.setAuto(!spin); setSpin(!spin); }
    else if (kind === "in") c.zoomBy(0.8);
    else if (kind === "out") c.zoomBy(1.25);
    else c.reset();
  }

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const sats = objects.slice(0, 12).map((o, i) => ({ o, rec: json2satrec(o as never) as SatRec, color: COLORS[i % COLORS.length] }));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
    host.style.overflow = "hidden";
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

    // Tierra: esfera grafito + contornos de tierra (Natural Earth 110m) + retícula
    const earth = new THREE.Group();
    scene.add(earth);
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x121211 })));
    const grid = new THREE.LineBasicMaterial({ color: 0x252521 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 121 }, (_, i) => ll(i * 3 - 180, lat, 1.0005));
      earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), grid));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = Array.from({ length: 61 }, (_, i) => ll(lon, i * 3 - 90, 1.0005));
      earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), grid));
    }
    import("world-atlas/land-110m.json").then((m) => {
      const topo = (m.default ?? m) as unknown as Topology;
      const land = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
      const mat = new THREE.LineBasicMaterial({ color: 0x716e66 });
      for (const f of land.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
        for (const poly of polys) for (const ring of poly) {
          earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]) => ll(lo, la))), mat));
        }
      }
    });
    // Halo atmosférico sutil
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.015, 64, 48), new THREE.MeshBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.04, side: THREE.BackSide })));

    // Órbitas: una vuelta completa centrada en "ahora", como bucle cerrado; se recalculan cada segundo
    const markers: THREE.Sprite[] = [];
    const lines: THREE.LineLoop[] = [];
    let maxR = 1.2;
    const periods = sats.map((s) => (1440 / s.o.MEAN_MOTION) * 60_000);
    for (const [i, s] of sats.entries()) {
      const pts = orbitPath(s.rec, Date.now(), periods[i], 240);
      if (pts.length > 2) maxR = Math.max(maxR, ...pts.map((p) => p.length()));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.6 }));
      scene.add(line);
      lines.push(line);
      // Icono con forma según el tipo de objeto (estación, satélite, etapa…), teñido con su color
      const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(iconFor(/ISS|CSS|TIANHE|ZARYA|TIANGONG/i.test(s.o.OBJECT_NAME) ? "stations" : "", s.o.OBJECT_NAME)), color: s.color, depthTest: false, transparent: true }));
      scene.add(mk);
      markers.push(mk);
    }
    let lastOrbit = Date.now();
    const dist = Math.min(Math.max(maxR * 2.3, 3.2), 16);
    const ctl = orbitControls(host, camera, dist);
    ctlRef.current = ctl;

    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0, lastLive = 0;
    const tick = (t: number) => {
      const date = new Date();
      const g = gstime(date);
      earth.rotation.y = g;
      const liveNow: Live[] = [];
      sats.forEach((s, i) => {
        const pv = propagate(s.rec, date);
        if (pv?.position && typeof pv.position !== "boolean") {
          markers[i].position.copy(eci(pv.position));
          markers[i].scale.setScalar(screenScale(camera, markers[i].position, 0.05));
          if (t - lastLive > 1000) {
            const geo = eciToGeodetic(pv.position, g);
            liveNow.push({ name: s.o.OBJECT_NAME, lat: degreesLat(geo.latitude), lon: degreesLong(geo.longitude), alt: geo.height, color: s.color });
          }
        }
      });
      if (liveNow.length) { setLive(liveNow); lastLive = t; }
      if (Date.now() - lastOrbit > 1000) {
        lastOrbit = Date.now();
        sats.forEach((s, i) => { lines[i].geometry.dispose(); lines[i].geometry = new THREE.BufferGeometry().setFromPoints(orbitPath(s.rec, lastOrbit, periods[i], 240)); });
      }
      ctl.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctl.dispose();
      ctlRef.current = null;
      renderer.dispose();
      host.innerHTML = "";
    };
  }, [objects]);

  return (
    <div className="relative">
      <div ref={el} style={{ height }} className="w-full cursor-grab touch-none active:cursor-grabbing" role="img" aria-label="Órbitas calculadas alrededor de la Tierra" />
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <CtlBtn label={spin ? "Pausar giro automático" : "Reanudar giro automático"} onClick={() => control("spin")}>{spin ? <Pause className="size-4" /> : <Play className="size-4" />}</CtlBtn>
        <CtlBtn label="Acercar" onClick={() => control("in")}><Plus className="size-4" /></CtlBtn>
        <CtlBtn label="Alejar" onClick={() => control("out")}><Minus className="size-4" /></CtlBtn>
        <CtlBtn label="Reencuadrar" onClick={() => control("reset")}><Maximize2 className="size-4" /></CtlBtn>
      </div>
      {live.length > 0 && (
        <ul className="pointer-events-none space-y-1 border-t border-line bg-bg/80 p-2.5 text-[11px] backdrop-blur md:absolute md:top-3 md:left-3 md:rounded-md md:border">
          {live.slice(0, 6).map((l) => (
            <li key={l.name} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              <span className="max-w-40 truncate text-fg">{l.name}</span>
              <span className="num text-fg-dim">{l.lat.toFixed(1)}°, {l.lon.toFixed(1)}° · {Math.round(l.alt).toLocaleString("es")} km</span>
            </li>
          ))}
        </ul>
      )}
      <p className="pointer-events-none px-3 pb-3 text-[10.5px] leading-snug text-fg-dim md:absolute md:right-3 md:bottom-3 md:max-w-xs md:p-0 md:text-right">
        Posición calculada (SGP4) a partir de elementos orbitales publicados por CelesTrak. No es telemetría en vivo.
      </p>
    </div>
  );
}

function CtlBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="flex size-8 items-center justify-center rounded-md border border-line bg-bg/85 text-fg-muted backdrop-blur hover:text-fg">{children}</button>
  );
}

/** Textura de icono (blanco sobre transparente) cacheada por tipo; el SpriteMaterial la tiñe. */
const iconCache = new Map<IconKind, THREE.CanvasTexture>();
function iconTexture(kind: IconKind) {
  let t = iconCache.get(kind);
  if (!t) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    drawIcon(cv.getContext("2d")!, kind, 128);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    iconCache.set(kind, t);
  }
  return t;
}
