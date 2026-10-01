// Motor 3D de la población orbital: decenas de miles de objetos reales con posición calculada (SGP4).
// Cada objeto se re-ancla con SGP4 (posición + velocidad) de forma escalonada dentro de un presupuesto de tiempo por
// fotograma; entre anclajes avanza sobre un arco de su plano orbital con su velocidad angular real (no en línea recta),
// lo que permite acelerar el tiempo sin que los puntos se dispersen. Las órbitas muy excéntricas se re-anclan en cada
// fotograma cuando el tiempo va acelerado.
import * as THREE from "three";
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, type SatRec } from "@/lib/sgp4";
import type { OMM } from "@/lib/orbit";
import type { PopRow } from "@/lib/satellites";
import { RE, buildEarth, disposeScene, makeRenderer, orbitControls, orbitPath, screenScale } from "./earth";

export const rowToOmm = (r: PopRow): OMM => ({
  NORAD_CAT_ID: r[0], OBJECT_NAME: r[1], OBJECT_ID: r[2], EPOCH: r[3], MEAN_MOTION: r[4], ECCENTRICITY: r[5], INCLINATION: r[6],
  RA_OF_ASC_NODE: r[7], ARG_OF_PERICENTER: r[8], MEAN_ANOMALY: r[9], BSTAR: r[10], MEAN_MOTION_DOT: r[11], MEAN_MOTION_DDOT: r[12],
  EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: "U", ELEMENT_SET_NO: 999, REV_AT_EPOCH: 0,
});

export type PopLive = { lat: number; lon: number; alt: number; speed: number };
export type ShellLabel = { el: HTMLElement; altKm: number };

const HIDDEN = 9; // tipo fuera de rango: el objeto no se dibuja (sin elementos válidos o ya sin solución SGP4)
const hex = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as [number, number, number];

export class PopulationEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 400);
  private renderer: THREE.WebGLRenderer;
  private disposeRenderer: () => void;
  private ctl: ReturnType<typeof orbitControls>;
  private earth: THREE.Group;
  private geo = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private n = 0;
  private ready = 0; // objetos ya preparados (la carga es progresiva)
  private rows: PopRow[] = [];
  private recs: (SatRec | null)[] = [];
  private kind = new Float32Array(0);
  private anchor = new Float32Array(0); // posición (three) en tA
  private perp = new Float32Array(0); // ĥ × p: dirección del avance en el plano orbital, con el mismo módulo que p
  private rate = new Float32Array(0); // velocidad angular instantánea (rad/s)
  private tA = new Float64Array(0);
  private pos = new Float32Array(0);
  private eccentric: number[] = [];
  private cursor = 0;
  private batch = 200;
  private raf = 0;
  private disposed = false;
  private onScreen = true;
  private io: IntersectionObserver;
  private listeners = new AbortController();
  private selected = -1;
  private marker: THREE.Group;
  private orbitLine: THREE.LineLoop | null = null;
  private lastOrbit = 0;
  private labels: ShellLabel[] = [];
  private target: number | null = null; // distancia de cámara hacia la que se anima el encuadre
  private home = 20;
  private mask = [true, true, true, true];
  // Reloj: en vivo es exactamente la hora real; en simulación avanza ×warp (0 = en pausa)
  private isLive = true;
  private warp = 1;
  private simMs = Date.now();
  private lastReal = Date.now();
  private dirty = true;
  onPick: (i: number | null) => void = () => {};
  onHover: (i: number | null, x: number, y: number) => void = () => {};

  constructor(private host: HTMLElement, colors: readonly string[], onHint?: () => void) {
    const r = makeRenderer(host, this.camera);
    this.renderer = r.renderer;
    this.disposeRenderer = r.dispose;
    this.earth = buildEarth(this.scene);
    this.ctl = orbitControls(host, this.camera, 20, onHint);
    this.home = this.fit(6.75);
    this.ctl.setDistance(this.home);

    // Guías a escala real en el plano ecuatorial: límite de la órbita baja, altitud GPS y anillo geoestacionario
    for (const [alt, op] of [[2000, 0.55], [20200, 0.45], [35786, 0.7]] as const) {
      const rr = 1 + alt / RE;
      const pts = Array.from({ length: 256 }, (_, k) => new THREE.Vector3(rr * Math.cos((k / 256) * Math.PI * 2), 0, rr * Math.sin((k / 256) * Math.PI * 2)));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x8f8b82, transparent: true, opacity: op * 0.5, dashSize: 0.05 * rr, gapSize: 0.06 * rr, depthWrite: false }));
      line.computeLineDistances();
      this.scene.add(line);
    }

    const [c0, c1, c2, c3] = colors.map(hex);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        c0: { value: new THREE.Vector3(...c0) }, c1: { value: new THREE.Vector3(...c1) }, c2: { value: new THREE.Vector3(...c2) }, c3: { value: new THREE.Vector3(...c3) },
        alpha: { value: new THREE.Vector4(0.95, 0.85, 0.8, 0.75) }, mask: { value: new THREE.Vector4(1, 1, 1, 1) },
        size: { value: 0.028 }, scale: { value: 300 }, minPx: { value: 1.6 }, maxPx: { value: 6 },
      },
      // Colores en sRGB tal cual (sin conversión): coinciden exactamente con la leyenda
      vertexShader: `
        attribute float kind; uniform vec4 mask; uniform vec4 alpha; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
        uniform float size; uniform float scale; uniform float minPx; uniform float maxPx;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 o = vec4(equal(vec4(kind), vec4(0.0, 1.0, 2.0, 3.0)));
          float vis = dot(o, mask);
          vColor = c0 * o.x + c1 * o.y + c2 * o.z + c3 * o.w;
          vAlpha = dot(o, alpha);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = vis * clamp(size * scale / -mv.z, minPx, maxPx);
          gl_Position = vis > 0.5 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.3, r));
        }`,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false; // rodean la Tierra: sin recalcular la esfera envolvente
    this.scene.add(this.points);

    // Marcador del seleccionado: anillo con tamaño constante en pantalla
    this.marker = new THREE.Group();
    this.marker.add(new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })));
    this.marker.visible = false;
    this.marker.renderOrder = 2;
    this.scene.add(this.marker);

    // Solo se calcula y dibuja mientras el globo está en pantalla
    this.io = new IntersectionObserver(([e]) => { this.onScreen = e.isIntersecting; });
    this.io.observe(host);

    // Clic = pulsación corta sin arrastre y con un solo puntero (un pellizco no deselecciona)
    let downX = 0, downY = 0, lastHover = 0, multi = false;
    const active = new Set<number>();
    const signal = this.listeners.signal;
    host.addEventListener("pointerdown", (e) => {
      this.target = null; // el usuario toma el control del encuadre
      active.add(e.pointerId);
      if (active.size === 1) { downX = e.clientX; downY = e.clientY; multi = false; } else multi = true;
    }, { signal });
    host.addEventListener("pointercancel", (e) => { active.delete(e.pointerId); }, { signal });
    host.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) this.target = null; }, { signal, passive: true });
    host.addEventListener("pointerup", (e) => {
      const was = active.delete(e.pointerId);
      if (!was || multi || active.size || Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const i = this.pick(e.clientX, e.clientY, e.pointerType === "touch" ? 22 : 12);
      this.select(i);
      this.onPick(i >= 0 ? i : null);
    }, { signal });
    host.addEventListener("pointermove", (e) => {
      const now = performance.now();
      if (now - lastHover < 70 || e.buttons || e.pointerType === "touch") return;
      lastHover = now;
      const i = this.pick(e.clientX, e.clientY, 10);
      const rect = host.getBoundingClientRect();
      this.onHover(i >= 0 ? i : null, e.clientX - rect.left, e.clientY - rect.top);
      host.style.cursor = i >= 0 ? "pointer" : "grab";
    }, { signal });
    host.addEventListener("pointerleave", () => this.onHover(null, 0, 0), { signal });
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Distancia de cámara para que una esfera de radio `r` (radios terrestres) quepa en la vista. */
  private fit(r: number) {
    const v = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const h = Math.atan(Math.tan(v) * this.camera.aspect);
    return Math.min((r * 1.06) / Math.tan(Math.min(v, h)), 60);
  }

  /** Carga progresiva: los objetos aparecen por tandas sin bloquear la página. */
  async load(rows: PopRow[], onProgress?: (done: number, total: number) => void) {
    const n = rows.length;
    this.rows = rows;
    this.n = n;
    this.ready = 0;
    this.cursor = 0;
    this.selected = -1;
    this.recs = new Array(n).fill(null);
    this.kind = new Float32Array(n).fill(HIDDEN);
    this.anchor = new Float32Array(n * 3);
    this.perp = new Float32Array(n * 3);
    this.rate = new Float32Array(n);
    this.tA = new Float64Array(n);
    this.pos = new Float32Array(n * 3);
    this.eccentric = [];
    this.geo.dispose();
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("kind", new THREE.BufferAttribute(this.kind, 1));
    this.points.geometry = this.geo;
    const CHUNK = 1500;
    for (let s = 0; s < n; s += CHUNK) {
      if (this.disposed) return;
      const e = Math.min(n, s + CHUNK);
      for (let i = s; i < e; i++) {
        const r = rows[i];
        try { this.recs[i] = json2satrec(rowToOmm(r) as never) as SatRec; } catch { this.recs[i] = null; }
        this.kind[i] = r[13];
        if (r[5] > 0.05) this.eccentric.push(i);
        this.reanchor(i, this.simMs);
      }
      this.ready = e;
      this.dirty = true;
      this.geo.attributes.kind.needsUpdate = true;
      onProgress?.(e, n);
      await new Promise((res) => setTimeout(res, 0));
    }
  }

  /** SGP4: posición y velocidad reales en `t` → ancla del arco. */
  private reanchor(i: number, t: number) {
    const rec = this.recs[i];
    const pv = rec ? propagate(rec, new Date(t)) : null;
    const j = i * 3;
    if (!pv?.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean" || !Number.isFinite(pv.position.x)) {
      if (this.kind[i] !== HIDDEN) { this.kind[i] = HIDDEN; this.geo.attributes.kind.needsUpdate = true; }
      this.rate[i] = 0; this.tA[i] = t;
      return;
    }
    const p = pv.position, v = pv.velocity;
    // Coordenadas three: (x, z, −y) / RE (rotación propia: conserva productos vectoriales)
    const px = p.x / RE, py = p.z / RE, pz = -p.y / RE;
    const vx = v.x / RE, vy = v.z / RE, vz = -v.y / RE;
    const hx = py * vz - pz * vy, hy = pz * vx - px * vz, hz = px * vy - py * vx;
    const h = Math.hypot(hx, hy, hz), r2 = px * px + py * py + pz * pz;
    this.anchor[j] = px; this.anchor[j + 1] = py; this.anchor[j + 2] = pz;
    if (h > 0 && r2 > 0) {
      const ux = hx / h, uy = hy / h, uz = hz / h;
      this.perp[j] = uy * pz - uz * py; this.perp[j + 1] = uz * px - ux * pz; this.perp[j + 2] = ux * py - uy * px;
      this.rate[i] = h / r2;
    } else this.rate[i] = 0;
    this.tA[i] = t;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const real = Date.now();
    const gap = real - this.lastReal;
    this.lastReal = real;
    if (!this.onScreen) return; // fuera de pantalla: ni cálculo ni dibujo (la simulación no avanza)
    const prev = this.simMs;
    this.simMs = this.isLive ? real : this.simMs + Math.min(gap, 250) * this.warp;
    const moving = this.simMs !== prev;
    const n = this.ready;
    if (n && (moving || this.dirty)) {
      const now = this.simMs;
      const t0 = performance.now();
      // Excéntricas: su velocidad angular cambia mucho a lo largo de la órbita → SGP4 en cada fotograma si el tiempo va acelerado
      if (!this.isLive && this.warp > 1) for (const i of this.eccentric) if (i < n) this.reanchor(i, now);
      const t1 = performance.now();
      // Re-anclaje escalonado con presupuesto de ~4 ms; en tiempo real basta una vuelta completa cada ~2 s
      const want = this.isLive || this.warp <= 1 ? Math.ceil(n / 120) : n;
      const count = Math.min(n, want, this.batch);
      for (let k = 0; k < count; k++) { this.cursor %= n; this.reanchor(this.cursor, now); this.cursor++; }
      const per = (performance.now() - t1) / Math.max(1, count);
      if (count >= this.batch * 0.9 && per > 0) this.batch = Math.max(60, Math.min(n, Math.floor(Math.max(0.5, 4 - (t1 - t0)) / per)));
      const a = this.anchor, q = this.perp, w = this.rate, tA = this.tA, out = this.pos;
      for (let i = 0; i < n; i++) {
        const th = (w[i] * (now - tA[i])) / 1000, c = Math.cos(th), s = Math.sin(th), j = i * 3;
        out[j] = a[j] * c + q[j] * s;
        out[j + 1] = a[j + 1] * c + q[j + 1] * s;
        out[j + 2] = a[j + 2] * c + q[j + 2] * s;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.dirty = false;
    }
    this.earth.rotation.y = gstime(new Date(this.simMs));

    // Encuadre animado (vistas predefinidas)
    if (this.target != null) {
      const cur = this.camera.position.length();
      const ratio = this.target / cur;
      if (Math.abs(Math.log(ratio)) < 0.002) this.target = null;
      else this.ctl.zoomBy(Math.pow(ratio, 0.12));
    }
    this.ctl.update();
    this.camera.updateMatrixWorld();

    if (this.selected >= 0) {
      const j = this.selected * 3;
      this.marker.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      this.marker.lookAt(this.camera.position);
      this.marker.scale.setScalar(screenScale(this.camera, this.marker.position, 0.014));
      if (real - this.lastOrbit > 1000 && moving) this.refreshOrbit();
    }
    this.material.uniforms.scale.value = (this.host.clientHeight / 2) * this.renderer.getPixelRatio();
    this.material.uniforms.minPx.value = 1.6 * this.renderer.getPixelRatio();
    this.material.uniforms.maxPx.value = 6 * this.renderer.getPixelRatio();
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  };

  /** Etiquetas HTML de las guías: en el punto del anillo más cercano a la cámara. */
  private placeLabels() {
    if (!this.labels.length) return;
    const c = this.camera.position, d = Math.hypot(c.x, c.z) || 1;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      const rr = 1 + l.altKm / RE;
      v.set((c.x / d) * rr, 0, (c.z / d) * rr).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (1 - (v.y * 0.5 + 0.5)) * H;
      const show = v.z < 1 && x > 40 && x < W - 40 && y > 8 && y < H - 24;
      l.el.style.opacity = show ? "1" : "0";
      if (show) l.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, 3px)`;
    }
  }
  setLabels(labels: ShellLabel[]) { this.labels = labels; }

  /** Objeto más cercano al puntero en pantalla, visible y no tapado por la Tierra. */
  private pick(cx: number, cy: number, radius: number) {
    const n = this.ready;
    if (!n) return -1;
    const rect = this.host.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top, W = rect.width, H = rect.height, r2 = radius * radius;
    const m = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).elements;
    const cand: [number, number][] = [];
    const p = this.pos;
    for (let i = 0; i < n; i++) {
      const k = this.kind[i];
      if (k === HIDDEN || !this.mask[k]) continue;
      const j = i * 3, x = p[j], y = p[j + 1], z = p[j + 2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0) continue;
      const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * W;
      const sy = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * H;
      const d2 = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d2 < r2) cand.push([d2, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const C = this.camera.position;
    for (const [, i] of cand) {
      const j = i * 3, dx = p[j] - C.x, dy = p[j + 1] - C.y, dz = p[j + 2] - C.z, L = Math.hypot(dx, dy, dz);
      const b = (C.x * dx + C.y * dy + C.z * dz) / L, c = C.lengthSq() - 1, disc = b * b - c;
      const t = disc > 0 ? -b - Math.sqrt(disc) : Infinity;
      if (!(t > 0 && t < L)) return i;
    }
    return -1;
  }

  select(i: number) {
    this.selected = i >= 0 && i < this.ready ? i : -1;
    this.marker.visible = this.selected >= 0;
    if (this.orbitLine) {
      this.scene.remove(this.orbitLine);
      this.orbitLine.geometry.dispose();
      (this.orbitLine.material as THREE.Material).dispose();
      this.orbitLine = null;
    }
    if (this.selected < 0 || !this.recs[this.selected]) return;
    this.orbitLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xecebe6, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(this.orbitLine);
    this.refreshOrbit();
  }

  private refreshOrbit() {
    const i = this.selected, rec = i >= 0 ? this.recs[i] : null;
    if (!rec || !this.orbitLine) return;
    const period = (1440 / this.rows[i][4]) * 60_000;
    this.orbitLine.geometry.dispose();
    this.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(orbitPath(rec, this.simMs, period, 240));
    this.lastOrbit = Date.now();
  }

  /** Estado calculado del objeto `i` en el instante mostrado. */
  live(i: number): PopLive | null {
    const rec = this.recs[i];
    if (!rec) return null;
    const d = new Date(this.simMs);
    const pv = propagate(rec, d);
    if (!pv?.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
    const g = eciToGeodetic(pv.position, gstime(d));
    return { lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), alt: g.height, speed: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) };
  }

  /** Visibilidad por tipo (0 carga útil, 1 etapa, 2 fragmento, 3 sin identificar). */
  setMask(mask: boolean[]) {
    this.mask = mask.slice(0, 4);
    this.material.uniforms.mask.value.set(...this.mask.map((v) => (v ? 1 : 0)) as [number, number, number, number]);
  }

  /** Tiempo: `live` = hora real; si no, simulación ×warp desde el instante actual (0 = en pausa). */
  setClock(live: boolean, warp: number) {
    if (live) this.simMs = Date.now();
    this.isLive = live;
    this.warp = live ? 1 : warp;
    this.lastReal = Date.now();
    // Volver a la hora real puede suponer un salto: se re-ancla todo de una vez
    if (live) for (let i = 0; i < this.ready; i++) this.reanchor(i, this.simMs);
    this.dirty = true;
  }
  get time() { return this.simMs; }

  /** Encuadres: radio (radios terrestres) que debe caber en la vista. */
  frame(radius: number) { this.target = this.fit(radius); }
  setAutoRotate(v: boolean) { this.ctl.setAuto(v); }
  zoomBy(f: number) { this.target = null; this.ctl.zoomBy(f); }
  resetView() { this.ctl.reset(); this.target = this.home; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.listeners.abort();
    this.io.disconnect();
    this.ctl.dispose();
    this.select(-1);
    this.scene.remove(this.points);
    this.geo.dispose();
    this.material.dispose();
    disposeScene(this.scene);
    this.disposeRenderer();
  }
}
