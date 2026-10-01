import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { propagate, type SatRec } from "@/lib/sgp4";

export const RE = 6371;

/** ECI (km) → coordenadas three (Y arriba), en radios terrestres. */
export const eciToThree = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x / RE, p.z / RE, -p.y / RE);

/** lon/lat (°) sobre la esfera, en el marco fijo a la Tierra. */
export const llToThree = (lon: number, lat: number, r = 1.001) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

/** Tierra minimalista: esfera grafito, retícula y contornos de Natural Earth (dominio público). Rotar con `earth.rotation.y = gmst`. */
export function buildEarth(scene: THREE.Scene) {
  const earth = new THREE.Group();
  scene.add(earth);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x121211 })));
  const grid = new THREE.LineBasicMaterial({ color: 0x252521 });
  for (let lat = -60; lat <= 60; lat += 30) earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 121 }, (_, i) => llToThree(i * 3 - 180, lat, 1.0005))), grid));
  for (let lon = -180; lon < 180; lon += 30) earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, (_, i) => llToThree(lon, i * 3 - 90, 1.0005))), grid));
  import("world-atlas/land-110m.json").then((m) => {
    const topo = (m.default ?? m) as unknown as Topology;
    const land = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
    const mat = new THREE.LineBasicMaterial({ color: 0x716e66 });
    for (const f of land.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
      for (const poly of polys) for (const ring of poly) earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]) => llToThree(lo, la))), mat));
    }
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.015, 64, 48), new THREE.MeshBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.04, side: THREE.BackSide })));
  return earth;
}

export const GLOBE_PAUSED = "net-globe-paused";

/** Cámara orbital: arrastre, rueda, pellizco táctil, giro automático pausable y reencuadre. */
export function orbitControls(host: HTMLElement, camera: THREE.PerspectiveCamera, dist: number) {
  let az = 0.6, el = 0.35, zoom = dist, maxZoom = dist * 2.5, home = dist;
  // Pausa del giro: preferencia única y guardada, compartida por todos los globos (sobrevive a cambios de selección)
  const paused = () => { try { return localStorage.getItem(GLOBE_PAUSED) === "1"; } catch { return false; } };
  let auto = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !paused();
  const onPref = () => { auto = !paused(); };
  window.addEventListener(`net:${GLOBE_PAUSED}`, onPref);
  window.addEventListener("storage", onPref);
  let dragging = false, px = 0, py = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const clampZoom = (z: number) => Math.max(1.4, Math.min(maxZoom, z));
  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    host.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { dragging = true; px = e.clientX; py = e.clientY; }
    if (pointers.size === 2) { const [p1, p2] = [...pointers.values()]; pinch = Math.hypot(p1.x - p2.x, p1.y - p2.y); dragging = false; }
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (pinch > 0) zoom = clampZoom(zoom * (pinch / d));
      pinch = d;
      return;
    }
    if (!dragging) return;
    az -= (e.clientX - px) * 0.006; el = Math.max(-1.3, Math.min(1.3, el + (e.clientY - py) * 0.006));
    px = e.clientX; py = e.clientY;
  };
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (pointers.size === 0) dragging = false; };
  const wheel = (e: WheelEvent) => { e.preventDefault(); zoom = clampZoom(zoom * (1 + Math.sign(e.deltaY) * 0.1)); };
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("wheel", wheel, { passive: false });
  return {
    /** Ajusta la distancia (p. ej. al cambiar de conjunto de satélites). */
    setDistance(d: number) { zoom = d; home = d; maxZoom = Math.max(d * 2.5, 12); },
    zoomBy(f: number) { zoom = clampZoom(zoom * f); },
    reset() { zoom = home; az = 0.6; el = 0.35; },
    setAuto(v: boolean) { auto = v; },
    get auto() { return auto; },
    update() {
      if (!dragging && pointers.size === 0 && auto) az += 0.0006;
      camera.position.set(zoom * Math.cos(el) * Math.sin(az), zoom * Math.sin(el), zoom * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, 0, 0);
    },
    dispose() {
      window.removeEventListener(`net:${GLOBE_PAUSED}`, onPref);
      window.removeEventListener("storage", onPref);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("wheel", wheel);
    },
  };
}

export function makeRenderer(host: HTMLElement, camera: THREE.PerspectiveCamera) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Canvas en bloque y al 100 % del contenedor: evita el bucle de crecimiento con ResizeObserver (desbordes)
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  host.style.overflow = "hidden";
  host.appendChild(renderer.domElement);
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  return { renderer, dispose: () => { ro.disconnect(); renderer.dispose(); host.innerHTML = ""; } };
}

/**
 * Puntos de una órbita completa CENTRADA en `tMs` (media vuelta atrás, media adelante),
 * para dibujar con THREE.LineLoop: el satélite queda siempre sobre el trazo y no hay hueco a su lado.
 */
export function orbitPath(rec: SatRec, tMs: number, periodMs: number, steps = 240) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < steps; k++) {
    const pv = propagate(rec, new Date(tMs - periodMs / 2 + (periodMs * k) / steps));
    if (pv?.position && typeof pv.position !== "boolean") pts.push(eciToThree(pv.position));
  }
  return pts;
}

/** Escala para que un objeto mida siempre lo mismo en pantalla, independientemente del zoom. */
export const screenScale = (camera: THREE.Camera, at: THREE.Vector3, k = 0.022) => camera.position.distanceTo(at) * k;
