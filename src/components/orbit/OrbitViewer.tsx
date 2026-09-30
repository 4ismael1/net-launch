"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
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

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const sats = objects.slice(0, 12).map((o, i) => ({ o, rec: json2satrec(o as never) as SatRec, color: COLORS[i % COLORS.length] }));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    // Órbitas: un periodo completo en marco inercial, desde "ahora"
    const markers: THREE.Mesh[] = [];
    let maxR = 1.2;
    for (const s of sats) {
      const period = (1440 / s.o.MEAN_MOTION) * 60_000;
      const now = Date.now();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 240; i++) {
        const pv = propagate(s.rec, new Date(now + (period * i) / 240));
        if (pv?.position && typeof pv.position !== "boolean") pts.push(eci(pv.position));
      }
      if (pts.length > 2) {
        maxR = Math.max(maxR, ...pts.map((p) => p.length()));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.55 })));
      }
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: s.color }));
      scene.add(mk);
      markers.push(mk);
    }
    const dist = Math.min(Math.max(maxR * 2.6, 3.2), 30);
    let az = 0.6, el2 = 0.35, dragging = false, px = 0, py = 0, zoom = dist;

    const onDown = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; host.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      az -= (e.clientX - px) * 0.006; el2 = Math.max(-1.3, Math.min(1.3, el2 + (e.clientY - py) * 0.006));
      px = e.clientX; py = e.clientY;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom = Math.max(1.8, Math.min(dist * 2, zoom * (1 + Math.sign(e.deltaY) * 0.1))); };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0, lastLive = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (t: number) => {
      const date = new Date();
      const g = gstime(date);
      earth.rotation.y = g;
      const liveNow: Live[] = [];
      sats.forEach((s, i) => {
        const pv = propagate(s.rec, date);
        if (pv?.position && typeof pv.position !== "boolean") {
          markers[i].position.copy(eci(pv.position));
          if (t - lastLive > 1000) {
            const geo = eciToGeodetic(pv.position, g);
            liveNow.push({ name: s.o.OBJECT_NAME, lat: degreesLat(geo.latitude), lon: degreesLong(geo.longitude), alt: geo.height, color: s.color });
          }
        }
      });
      if (liveNow.length) { setLive(liveNow); lastLive = t; }
      if (!dragging && !reduce) az += 0.0006;
      camera.position.set(zoom * Math.cos(el2) * Math.sin(az), zoom * Math.sin(el2), zoom * Math.cos(el2) * Math.cos(az));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("wheel", onWheel);
      renderer.dispose();
      host.innerHTML = "";
    };
  }, [objects]);

  return (
    <div className="relative">
      <div ref={el} style={{ height }} className="w-full cursor-grab touch-none active:cursor-grabbing" role="img" aria-label="Órbitas calculadas alrededor de la Tierra" />
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
