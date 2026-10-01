"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import clsx from "clsx";
import { FastForward, Maximize2, Minus, Pause, Play, Plus, Rewind } from "lucide-react";
import { disposeScene, makeRenderer } from "@/components/orbit/earth";
import { GlobeHint, useWheelHint } from "@/components/orbit/GlobeHint";
import type { Sample } from "@/lib/data/universe";
import { AU, C_KM_S, PLANETS, au, inWindow, interp, km, len, light, planetKey, planetOrbit, planetState, probeKey, probeSpeed, sub, type SelKey, type V3 } from "./solar";
import { solarControls } from "./solarControls";

export type Probe3D = { id: number; name: string; agency: string; s: Sample[] };

const RATES = [
  { v: 1, label: "Tiempo real" },
  { v: 86400, label: "1 día/s" },
  { v: 7 * 86400, label: "1 sem/s" },
  { v: 30 * 86400, label: "1 mes/s" },
];
// Margen de fechas de la simulación (el modelo planetario es fiable de sobra en este intervalo)
const T_MIN = Date.UTC(1950, 0, 1), T_MAX = Date.UTC(2150, 0, 1);

// Escalas radiales (unidades de escena). La dirección es siempre la real; solo cambia la distancia al Sol.
// Logarítmica: 0,1 ua → 3 · 1 ua → 10,4 · 30 ua → 24,8 · 170 ua → 32,3. Lineal: 1 ua = 0,2 (170 ua → 34).
const LIN = 0.2;
const rLog = (r: number) => 10 * Math.log10(1 + r / 0.1);
const mapR = (rAu: number, b: number) => (1 - b) * rLog(rAu) + b * rAu * LIN;
const FRAME_R = 34;

/** km (eclíptica J2000) → escena (Y = polo norte de la eclíptica), con la escala mezclada `b` (0 log, 1 lineal). */
function mapKm(x: number, y: number, z: number, b: number, out: THREE.Vector3) {
  const r = Math.hypot(x, y, z) / AU;
  const s = r > 0 ? mapR(r, b) / r / AU : 0;
  return out.set(x * s, z * s, -y * s);
}

type Body = { key: SelKey; name: string; kind: "sun" | "planet" | "probe"; color: string; px: number; shape: number; probe?: Probe3D; planet?: (typeof PLANETS)[number] };
type Mapped = { geo: THREE.BufferGeometry; raw: Float32Array; line?: THREE.Line };

const VERT = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aShape; attribute float aAlpha;
uniform float uPR;
varying vec3 vColor; varying float vShape; varying float vAlpha; varying float vSize;
void main() {
  vColor = aColor; vShape = aShape; vAlpha = aAlpha; vSize = aSize * uPR;
  gl_PointSize = vSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vColor; varying float vShape; varying float vAlpha; varying float vSize;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float px = 2.0 / vSize; // un píxel en unidades de radio
  float a;
  if (vShape < 0.5) { float d = length(c) * 2.0; a = 1.0 - smoothstep(1.0 - px * 1.5, 1.0, d); }
  else if (vShape < 1.5) { float d = (abs(c.x) + abs(c.y)) * 2.0; a = 1.0 - smoothstep(1.0 - px * 1.5, 1.0, d); }
  else if (vShape < 2.5) { float d = length(c) * 2.0; a = 1.0 - smoothstep(px * 0.75, px * 1.75, abs(d - (1.0 - px * 2.0))); }
  else { float d = length(c) * 2.0; a = pow(max(0.0, 1.0 - d), 2.2); }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

const hex = (h: string) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const ACCENT = "#ff5b1f";
const fmtDate = (t: number) => new Date(t).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = (t: number) => new Date(t).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Api = { focus: (k: SelKey) => void; refocus: () => void; toNow: () => void; zoom: (f: number) => void; reset: () => void; dirty: () => void };

/**
 * Sistema solar en 3D: planetas (astronomy-engine) y sondas (JPL Horizons) en su posición heliocéntrica real.
 * Simulación temporal: los planetas se calculan para cualquier fecha; las sondas solo dentro del intervalo de efemérides
 * (fuera de él se ocultan: no se extrapola).
 */
export function SolarSystem3D({ probes, earth, sel, onSel }: { probes: Probe3D[]; earth: Sample[] | null; sel: SelKey; onSel: (k: SelKey) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const labelsEl = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const simRef = useRef<number | null>(null); // fecha simulada: se conserva al ocultar/mostrar la página
  const [hint, pingHint] = useWheelHint();
  const [ready, setReady] = useState(false);
  const [glError, setGlError] = useState(false);
  const [simT, setSimT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [dir, setDir] = useState(1);
  const [synced, setSynced] = useState(true);
  const [scale, setScale] = useState<"log" | "lin">("log");

  // Estado que lee el bucle de animación sin recrear la escena
  const st = useRef({ playing, rate, dir, synced, scale, sel, onSel });
  useEffect(() => { st.current = { playing, rate, dir, synced, scale, sel, onSel }; api.current?.dirty(); }, [playing, rate, dir, synced, scale, sel, onSel]);

  // Selección desde las tarjetas → vuelo de cámara (no al volver a mostrar la página con la misma selección)
  const focused = useRef(sel);
  useEffect(() => {
    if (focused.current === sel) return;
    focused.current = sel;
    api.current?.focus(sel);
  }, [sel]);
  // Cambio de escala con un cuerpo seguido: reencuadrar para la nueva escala
  const scaleSeen = useRef(scale);
  useEffect(() => {
    if (scaleSeen.current === scale) return;
    scaleSeen.current = scale;
    const t = setTimeout(() => api.current?.refocus(), 950);
    return () => clearTimeout(t);
  }, [scale]);

  const win = probes.length ? [Math.min(...probes.map((p) => p.s[0][0])), Math.max(...probes.map((p) => p.s[p.s.length - 1][0]))] as const : null;

  useEffect(() => {
    const host = el.current, lhost = labelsEl.current;
    if (!host || !lhost) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    let gl: ReturnType<typeof makeRenderer>;
    try { gl = makeRenderer(host, camera); } catch { queueMicrotask(() => setGlError(true)); return; }
    const { renderer } = gl;

    let simT = !st.current.synced && simRef.current != null ? simRef.current : Date.now();
    // Mezcla de escalas: `bl` avanza linealmente al cambiar de escala, `b` es su versión suavizada (la que se usa)
    let bl = st.current.scale === "lin" ? 1 : 0, b = bl;
    let dirty = true, visible = true, hover: SelKey | null = null, track: SelKey | null = null;

    // ── Cuerpos ──
    const bodies: Body[] = [
      { key: "sun", name: "Sol", kind: "sun", color: "#ffd9a0", px: 11, shape: 0 },
      ...PLANETS.map((p) => ({ key: planetKey(p.b), name: p.name, kind: "planet" as const, color: p.color, px: p.px, shape: 0, planet: p })),
      ...probes.map((p) => ({ key: probeKey(p.id), name: p.name, kind: "probe" as const, color: "#ecebe6", px: 8, shape: 1, probe: p })),
    ];
    const posKm: (V3 | null)[] = bodies.map(() => null);
    const pos = bodies.map(() => new THREE.Vector3());
    const screen = bodies.map(() => ({ x: 0, y: 0, on: false }));

    // ── Geometrías con escala radial (se rehacen al cambiar la escala) ──
    const mapped: Mapped[] = [];
    const tmp = new THREE.Vector3();
    const remap = (m: Mapped) => {
      const a = m.geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < m.raw.length; i += 3) { mapKm(m.raw[i], m.raw[i + 1], m.raw[i + 2], b, tmp); a.setXYZ(i / 3, tmp.x, tmp.y, tmp.z); }
      a.needsUpdate = true;
      m.geo.computeBoundingSphere();
      if (m.line instanceof THREE.LineLoop && m.line.material instanceof THREE.LineDashedMaterial) m.line.computeLineDistances();
    };
    const addMapped = (raw: number[], make: (g: THREE.BufferGeometry) => THREE.Line | THREE.Mesh, index?: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(raw.length), 3));
      if (index) geo.setIndex(index);
      const obj = make(geo);
      const m: Mapped = { geo, raw: new Float32Array(raw), line: obj instanceof THREE.Line ? obj : undefined };
      scene.add(obj);
      mapped.push(m);
      remap(m);
      return obj;
    };
    const circle = (rAu: number, n = 192) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [Math.cos(a) * rAu * AU, Math.sin(a) * rAu * AU, 0]; }).flat();

    // Anillos de referencia en el plano de la eclíptica (1, 10 y 100 ua), heliopausa y cinturón de Kuiper
    for (const r of [1, 10, 100]) addMapped(circle(r), (g) => new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: 0x2a2925, transparent: true, opacity: 0.9 })));
    addMapped(circle(120, 256), (g) => new THREE.LineLoop(g, new THREE.LineDashedMaterial({ color: ACCENT, transparent: true, opacity: 0.35, dashSize: 0.5, gapSize: 0.9 })));
    {
      const n = 160, raw: number[] = [], idx: number[] = [];
      for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; for (const r of [30, 50]) raw.push(Math.cos(a) * r * AU, Math.sin(a) * r * AU, 0); }
      for (let k = 0; k < n; k++) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      addMapped(raw, (g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xecebe6, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false })), idx);
    }
    // Órbitas reales: una vuelta de cada planeta calculada con astronomy-engine
    const orbitMat = new Map<SelKey, THREE.LineBasicMaterial>();
    for (const p of PLANETS) {
      const mat = new THREE.LineBasicMaterial({ color: 0x4a4842, transparent: true, opacity: 0.85 });
      orbitMat.set(planetKey(p.b), mat);
      addMapped(planetOrbit(p, simT, p.periodDays > 20000 ? 200 : 256).flat(), (g) => new THREE.LineLoop(g, mat));
    }
    // Trayectoria de cada sonda en el intervalo de efemérides (muestras reales de Horizons)
    const trails = new Map<SelKey, THREE.Line>();
    for (const p of probes) {
      const line = addMapped(p.s.flatMap((x) => [x[1], x[2], x[3]]), (g) => new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xecebe6, transparent: true, opacity: 0.25 }))) as THREE.Line;
      trails.set(probeKey(p.id), line);
    }

    // ── Puntos: halo del Sol, cuerpos y dos anillos (selección y paso del ratón), en una sola llamada de dibujo ──
    const N = bodies.length + 3;
    const pg = new THREE.BufferGeometry();
    const aPos = new Float32Array(N * 3), aCol = new Float32Array(N * 3), aSize = new Float32Array(N), aShape = new Float32Array(N), aAlpha = new Float32Array(N);
    pg.setAttribute("position", new THREE.BufferAttribute(aPos, 3));
    pg.setAttribute("aColor", new THREE.BufferAttribute(aCol, 3));
    pg.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    pg.setAttribute("aShape", new THREE.BufferAttribute(aShape, 1));
    pg.setAttribute("aAlpha", new THREE.BufferAttribute(aAlpha, 1));
    const pmat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uPR: { value: renderer.getPixelRatio() } }, transparent: true, depthTest: false, depthWrite: false });
    const points = new THREE.Points(pg, pmat);
    points.frustumCulled = false;
    points.renderOrder = 10;
    scene.add(points);
    aCol.set(hex("#ff9a3d"), 0); aSize[0] = 70; aShape[0] = 3; aAlpha[0] = 0.55; // halo
    const SEL = N - 2, HOV = N - 1;
    aCol.set(hex(ACCENT), SEL * 3); aShape[SEL] = 2; aCol.set(hex("#a6a39a"), HOV * 3); aShape[HOV] = 2;

    // ── Etiquetas HTML (más nítidas que texto en WebGL y sin solaparse) ──
    const mkLabel = (cls: string, text: string) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; lhost.appendChild(s); return s; };
    const labels = bodies.map((bd) => mkLabel("absolute left-0 top-0 whitespace-nowrap text-[11px] leading-none transition-opacity duration-200 [text-shadow:0_0_4px_#0b0b0a,0_0_2px_#0b0b0a]", bd.name));
    const refs = [
      { r: 1, a: 0, t: "1 ua" }, { r: 10, a: 0, t: "10 ua" }, { r: 100, a: 0, t: "100 ua" }, { r: 120, a: Math.PI / 2, t: "Heliopausa · ≈ 120 ua", accent: true }, { r: 40, a: Math.PI * 0.75, t: "Cinturón de Kuiper" },
    ].map((x) => ({ ...x, el: mkLabel(clsx("absolute left-0 top-0 whitespace-nowrap font-mono text-[9.5px] leading-none transition-opacity duration-200", x.accent ? "text-accent/70" : "text-fg-dim"), x.t) }));

    // ── Cámara ──
    const fit = () => {
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const h = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
      return (FRAME_R / Math.sin(h)) * 0.98;
    };
    const pick = (x: number, y: number, touch: boolean) => {
      let best = -1, bd = touch ? 30 : 18;
      screen.forEach((s, i) => { if (!s.on) return; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } });
      return best >= 0 ? bodies[best].key : null;
    };
    const ctl = solarControls(host, camera, {
      dist: fit(), minDist: 0.03, maxDist: 220, onHint: pingHint,
      onTap: (x, y, touch) => { const k = pick(x, y, touch); if (!k) return; if (k === st.current.sel) focus(k); else st.current.onSel(k); },
      onHover: (x, y) => { const k = pick(x, y, false); if (k !== hover) { hover = k; host.style.cursor = k ? "pointer" : ""; dirty = true; } },
      onLeave: () => { if (hover) { hover = null; host.style.cursor = ""; dirty = true; } },
    });
    const ro = new ResizeObserver(() => { pmat.uniforms.uPR.value = renderer.getPixelRatio(); ctl.setLimits(0.03, 220, fit()); dirty = true; });
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; dirty = true; });
    io.observe(host);

    const idxOf = (k: SelKey) => bodies.findIndex((x) => x.key === k);
    function focus(k: SelKey) {
      const i = idxOf(k);
      if (i < 0) return;
      if (bodies[i].kind === "sun") { track = null; if (b > 0.5) ctl.flyTo(new THREE.Vector3(), 1.6); else ctl.reset(); dirty = true; return; }
      if (!posKm[i]) return; // sonda fuera del intervalo de efemérides: no hay a dónde ir
      track = k;
      const p = mapKm(...posKm[i]!, b, new THREE.Vector3());
      ctl.flyTo(p, Math.max(b > 0.5 ? 0.12 : 2.2, p.length() * 0.4));
      dirty = true;
    }
    api.current = {
      focus,
      toNow: () => { simT = Date.now(); compute(); dirty = true; },
      zoom: (f) => { ctl.zoomBy(f); dirty = true; },
      reset: () => { track = null; ctl.reset(); dirty = true; },
      refocus: () => { if (track) focus(track); },
      dirty: () => { dirty = true; },
    };

    function compute() {
      bodies.forEach((bd, i) => {
        if (bd.planet) posKm[i] = planetState(bd.planet.b, simT).pos;
        else if (bd.probe) posKm[i] = inWindow(bd.probe.s, simT) ? interp(bd.probe.s, simT) : null;
        else posKm[i] = [0, 0, 0];
      });
    }
    compute();

    const project = (v: THREE.Vector3, W: number, H: number, o: { x: number; y: number; on: boolean }) => {
      tmp.copy(v).project(camera);
      o.x = ((tmp.x + 1) / 2) * W; o.y = ((1 - tmp.y) / 2) * H; o.on = tmp.z < 1 && tmp.z > -1 && o.x > -40 && o.x < W + 40 && o.y > -20 && o.y < H + 20;
      return o;
    };

    function draw() {
      const s = st.current;
      const W = host!.clientWidth, H = host!.clientHeight;
      // Puntos
      bodies.forEach((bd, i) => {
        const j = i + 1, p = posKm[i];
        if (p) mapKm(p[0], p[1], p[2], b, pos[i]);
        aPos.set([pos[i].x, pos[i].y, pos[i].z], j * 3);
        aCol.set(hex(bd.kind === "probe" && bd.key === s.sel ? ACCENT : bd.color), j * 3);
        aSize[j] = bd.px * (bd.key === hover || bd.key === s.sel ? 1.25 : 1);
        aShape[j] = bd.shape;
        aAlpha[j] = p ? 1 : 0;
        if (p) project(pos[i], W, H, screen[i]); else screen[i].on = false;
      });
      const si = idxOf(s.sel), hi = hover ? idxOf(hover) : -1;
      for (const [slot, i, size] of [[SEL, si, 26], [HOV, hi !== si ? hi : -1, 22]] as const) {
        aAlpha[slot] = i >= 0 && posKm[i] ? (slot === SEL ? 0.95 : 0.6) : 0;
        if (i >= 0) aPos.set([pos[i].x, pos[i].y, pos[i].z], slot * 3);
        aSize[slot] = size + (i >= 0 ? bodies[i].px * 0.6 : 0);
      }
      for (const name of ["position", "aColor", "aSize", "aShape", "aAlpha"]) pg.getAttribute(name).needsUpdate = true;
      // Órbita y trayectoria resaltadas
      orbitMat.forEach((m, k) => { const on = k === s.sel; m.color.set(on ? ACCENT : 0x4a4842); m.opacity = on ? 0.75 : 0.85; });
      trails.forEach((l, k) => {
        const i = idxOf(k);
        l.visible = !!posKm[i];
        const m = l.material as THREE.LineBasicMaterial;
        m.color.set(k === s.sel ? ACCENT : 0xecebe6); m.opacity = k === s.sel ? 0.9 : 0.25;
      });
      renderer.render(scene, camera);

      // Etiquetas sin solaparse: selección y ratón primero, luego Sol, planetas, sondas
      const order = bodies.map((_, i) => i).sort((x, y) => rank(x) - rank(y));
      function rank(i: number) { const k = bodies[i].key; return k === s.sel ? 0 : k === hover ? 1 : bodies[i].kind === "sun" ? 2 : bodies[i].kind === "planet" ? 3 : 4; }
      const placed: { x: number; y: number; w: number }[] = [];
      const free = (x: number, y: number, w: number) => !placed.some((q) => Math.abs(q.y - y) < 13 && x + w > q.x && x < q.x + q.w);
      for (const i of order) {
        const sc = screen[i], lab = labels[i], bd = bodies[i];
        const prio = bd.key === s.sel || bd.key === hover;
        const x = sc.x + bd.px / 2 + 6, y = sc.y - 6, w = bd.name.length * 6.4 + 6;
        const show = sc.on && (prio || free(x, y, w));
        if (show) placed.push({ x, y, w });
        lab.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        lab.style.opacity = show ? "1" : "0";
        lab.style.color = bd.key === s.sel ? "var(--color-fg)" : bd.kind === "planet" || bd.kind === "sun" ? "var(--color-fg-muted)" : "#c9c7bf";
        lab.style.fontWeight = prio ? "600" : "400";
      }
      for (const r of refs) {
        mapKm(Math.cos(r.a) * r.r * AU, Math.sin(r.a) * r.r * AU, 0, b, tmp);
        const o = project(tmp, W, H, { x: 0, y: 0, on: false });
        const x = o.x + 4, y = o.y + 3, w = r.t.length * 5.8;
        const show = o.on && free(x, y, w) && !(r.r === 1 && b > 0.5 && ctl.dist > 20);
        if (show) placed.push({ x, y, w });
        r.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        r.el.style.opacity = show ? "1" : "0";
      }
    }

    let raf = 0, last = performance.now(), lastLive = 0, lastUi = 0, uiT = NaN, first = true;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(100, now - last); // pestaña oculta: sin saltos al volver
      last = now;
      if (!visible) return;
      const s = st.current;
      let changed = false;
      if (s.playing) {
        if (s.synced) { if (now - lastLive > 1000) { lastLive = now; simT = Date.now(); changed = true; } }
        else {
          simT += dt * s.rate * s.dir;
          if (simT <= T_MIN || simT >= T_MAX) { simT = Math.min(T_MAX, Math.max(T_MIN, simT)); }
          changed = true;
        }
      }
      const goalB = s.scale === "lin" ? 1 : 0;
      if (bl !== goalB) {
        bl = goalB > bl ? Math.min(goalB, bl + dt / 900) : Math.max(goalB, bl - dt / 900);
        b = bl * bl * (3 - 2 * bl);
        mapped.forEach(remap);
        changed = true;
      }
      if (changed) { compute(); simRef.current = simT; }
      // Seguir al cuerpo elegido mientras se mueve
      if (track) { const i = idxOf(track); const p = posKm[i]; if (p) ctl.goal.target.copy(mapKm(p[0], p[1], p[2], b, tmp)); }
      const moving = ctl.update(dt);
      if (!(dirty || changed || moving || first)) return;
      dirty = false;
      draw();
      if (first) { first = false; setReady(true); }
      // Fecha y ficha en React a 4 Hz (y siempre al detenerse, para que muestren el instante exacto)
      if (simT !== uiT && (now - lastUi > 250 || !s.playing)) { lastUi = now; uiT = simT; setSimT(simT); }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ctl.dispose();
      ro.disconnect();
      io.disconnect();
      api.current = null;
      lhost.replaceChildren();
      disposeScene(scene);
      gl.dispose();
    };
  }, [probes, earth, pingHint]);

  const t = simT;
  const outside = t != null && win != null && (t < win[0] || t > win[1]);
  const setRateKeep = (v: number) => { setRate(v); setSynced(false); setPlaying(true); };
  const toNow = () => { setRate(1); setDir(1); setSynced(true); setPlaying(true); api.current?.toNow(); };

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="relative">
        <div ref={el} className="h-[420px] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing sm:h-[520px] lg:h-[600px]" role="img"
          aria-label="Sistema solar en 3D con los planetas y las sondas en su posición heliocéntrica. Usa las listas de abajo para elegir un objeto con el teclado." />
        <div ref={labelsEl} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />
        {!ready && !glError && (
          <div className="absolute inset-0 grid animate-pulse place-items-center bg-surface text-xs text-fg-dim">Preparando el sistema solar…</div>
        )}
        {glError && (
          <div className="absolute inset-0 grid place-items-center bg-surface p-6 text-center text-sm text-fg-muted">Tu navegador no pudo iniciar la vista 3D (WebGL). Los datos siguen disponibles en las tarjetas.</div>
        )}
        <GlobeHint show={hint} />

        <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-line bg-bg/80 px-2.5 py-1.5 backdrop-blur">
          <p className="label flex items-center gap-1.5">
            {synced && playing ? <><span className="size-1.5 animate-pulse rounded-full bg-accent" />En vivo</> : "Fecha simulada"}
          </p>
          <p className="num mt-0.5 text-xs text-fg" suppressHydrationWarning>{t != null ? fmtDate(t) : "—"}</p>
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <CtlBtn label="Acercar" onClick={() => api.current?.zoom(0.7)}><Plus className="size-4" /></CtlBtn>
          <CtlBtn label="Alejar" onClick={() => api.current?.zoom(1.4)}><Minus className="size-4" /></CtlBtn>
          <CtlBtn label="Ver todo el sistema solar" onClick={() => api.current?.reset()}><Maximize2 className="size-4" /></CtlBtn>
        </div>
        {outside && win && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-md animate-fade-in rounded-md border border-accent/40 bg-bg/90 px-3 py-2 text-center text-[11px] leading-snug text-fg-muted backdrop-blur">
            Posición de las sondas disponible solo entre el <span className="text-fg">{fmtDay(win[0])}</span> y el <span className="text-fg">{fmtDay(win[1])}</span> (efemérides de JPL Horizons). Fuera de ese intervalo se ocultan: no se extrapolan.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
        <CtlBtn label={playing ? "Pausar simulación" : "Reanudar simulación"} onClick={() => { setPlaying(!playing); if (playing) setSynced(false); }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</CtlBtn>
        <CtlBtn label={dir > 0 ? "Simular hacia atrás" : "Simular hacia adelante"} onClick={() => { setDir(-dir); setSynced(false); if (rate === 1) setRate(86400); setPlaying(true); }}>{dir > 0 ? <Rewind className="size-4" /> : <FastForward className="size-4" />}</CtlBtn>
        <div role="group" aria-label="Velocidad de la simulación" className="flex overflow-hidden rounded-md border border-line">
          {RATES.map((r) => {
            const on = r.v === 1 ? synced : !synced && rate === r.v;
            return (
              <button key={r.v} onClick={() => (r.v === 1 ? toNow() : setRateKeep(r.v))} aria-pressed={on}
                className={clsx("px-2 py-1.5 text-[11px] transition-colors", on ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}>
                {r.v !== 1 && dir < 0 ? "−" : ""}{r.label}
              </button>
            );
          })}
        </div>
        <button onClick={toNow} disabled={synced && playing} className="rounded-md border border-line px-2.5 py-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg disabled:opacity-40">Ahora</button>
        <div role="group" aria-label="Escala de distancias" className="ml-auto flex overflow-hidden rounded-md border border-line">
          {(["log", "lin"] as const).map((k) => (
            <button key={k} onClick={() => setScale(k)} aria-pressed={scale === k}
              className={clsx("px-2 py-1.5 text-[11px] transition-colors", scale === k ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}>
              {k === "log" ? "Escala logarítmica" : "Escala real (lineal)"}
            </button>
          ))}
        </div>
      </div>

      <BodyCard sel={sel} t={t} probes={probes} earth={earth} win={win} />

      <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-fg-dim">
        {scale === "log"
          ? "Distancias al Sol en escala logarítmica (anillos de 1, 10 y 100 ua); las direcciones son reales. "
          : "Escala lineal real: 1 ua = 1/170 de la distancia a la Voyager 1. Acerca la cámara para ver los planetas interiores. "}
        Tamaños de los puntos no a escala. Toca o haz clic en cualquier objeto para identificarlo; arrastra para girar y usa Ctrl/⌘ + rueda o pellizca para acercar.
        Planetas y órbitas: astronomy-engine. Sondas: JPL Horizons (NASA/JPL), muestras cada 6 h interpoladas.
      </p>
    </section>
  );
}

/** Ficha del objeto elegido en la fecha simulada. */
function BodyCard({ sel, t, probes, earth, win }: { sel: SelKey; t: number | null; probes: Probe3D[]; earth: Sample[] | null; win: readonly [number, number] | null }) {
  if (t == null) return <div className="h-[74px] border-t border-line" />;
  const probe = sel.startsWith("p:") ? probes.find((p) => probeKey(p.id) === sel) : undefined;
  const planet = sel.startsWith("b:") ? PLANETS.find((p) => planetKey(p.b) === sel) : undefined;
  const earthPos: V3 = earth && inWindow(earth, t) ? interp(earth, t) : planetState(PLANETS[2].b, t).pos;
  let name = "Sol", kind = "Estrella", source = "Centro del sistema de referencia";
  let p: V3 | null = [0, 0, 0], speed: number | null = null;
  if (planet) {
    const s = planetState(planet.b, t);
    name = planet.name; kind = "Planeta"; source = "Calculada con astronomy-engine (VSOP87)"; p = s.pos; speed = s.speed;
    if (planet.b === PLANETS[2].b) p = earthPos;
  } else if (probe) {
    name = probe.name; kind = `Sonda · ${probe.agency}`; source = "JPL Horizons (NASA/JPL), interpolada";
    p = inWindow(probe.s, t) ? interp(probe.s, t) : null;
    speed = p ? probeSpeed(probe.s, t) : null;
  }
  const isEarth = planet?.b === PLANETS[2].b;
  const dSun = p ? len(p) : 0, dEarth = p ? len(sub(p, earthPos)) : 0;
  const stat = (l: string, v: string, sub2?: string) => (
    <div className="min-w-0"><dt className="label truncate">{l}</dt><dd className="num mt-0.5 truncate text-sm text-fg" suppressHydrationWarning>{v}</dd>{sub2 && <dd className="num truncate text-[10.5px] text-fg-dim" suppressHydrationWarning>{sub2}</dd>}</div>
  );
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold"><span className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rotate-45 bg-accent" />{name} <span className="font-normal text-fg-dim">· {kind}</span></p>
        <p className="text-[10.5px] text-fg-dim">{source}</p>
      </div>
      {p ? (
        <dl className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-x-4 gap-y-2">
          {sel !== "sun" && stat("Distancia al Sol", `${km(dSun)} km`, `${au(dSun)} ua`)}
          {!isEarth && stat("Distancia a la Tierra", `${km(dEarth)} km`, `${au(dEarth)} ua`)}
          {!isEarth && stat(probe ? "Señal de radio tarda" : "La luz tarda", light(dEarth / C_KM_S), "hasta la Tierra")}
          {speed != null && stat("Velocidad respecto al Sol", `${speed.toLocaleString("es", { maximumFractionDigits: 2 })} km/s`, `${km(speed * 3600)} km/h`)}
        </dl>
      ) : (
        <p className="mt-1.5 text-xs text-fg-muted">
          Sin posición para esta fecha: las efemérides de JPL Horizons cubren solo {win ? <>del {fmtDay(win[0])} al {fmtDay(win[1])}</> : "unos días"}. No se extrapola. Pulsa «Ahora» para volver.
        </p>
      )}
    </div>
  );
}

function CtlBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="flex size-8 items-center justify-center rounded-md border border-line bg-bg/85 text-fg-muted backdrop-blur transition-colors hover:text-fg">{children}</button>
  );
}
