// Motor 3D del explorador de satélites.
// Tiempo real: cada satélite se re-ancla con SGP4 (posición + velocidad) en rondas de ~1 s y, entre anclajes,
// avanza fotograma a fotograma con su velocidad real. Nada de puntos fijos ni saltos.
import * as THREE from "three";
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, type SatRec } from "@/lib/sgp4";
import type { OMM } from "@/lib/orbit";
import { RE, buildEarth, eciToThree, makeRenderer, orbitControls } from "./earth";
import { ICON_KINDS, buildAtlas, type IconKind } from "./satIcons";

export type EngineSat = { omm: OMM; color: string; group: string; icon: IconKind };
export type LiveInfo = { norad: number; name: string; group: string; lat: number; lon: number; alt: number; speed: number };

export class SatEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 300);
  private disposeRenderer: () => void;
  private renderer: THREE.WebGLRenderer;
  private ctl: ReturnType<typeof orbitControls>;
  private earth: THREE.Group;
  private points: THREE.Points | null = null;
  private geo = new THREE.BufferGeometry();
  private sats: EngineSat[] = [];
  private recs: (SatRec | null)[] = [];
  private anchor = new Float32Array(0); // posición (three) en tAnchor
  private vel = new Float32Array(0); // velocidad (three/s)
  private tAnchor = new Float64Array(0);
  private pos = new Float32Array(0);
  private cursor = 0;
  private raf = 0;
  private selected = -1;
  private marker: THREE.Group;
  private orbitLine: THREE.Line | null = null;
  private raycaster = new THREE.Raycaster();
  // Reloj: en ×1 es exactamente la hora real; con aceleración avanza más rápido y se indica en la interfaz.
  private warp = 1;
  private simMs = Date.now();
  private lastReal = Date.now();
  private atlas: THREE.CanvasTexture | null = null;
  private material: THREE.ShaderMaterial | null = null;
  onPick: (norad: number | null) => void = () => {};
  onHover: (name: string | null, x: number, y: number) => void = () => {};

  constructor(private host: HTMLElement) {
    const r = makeRenderer(host, this.camera);
    this.renderer = r.renderer;
    this.disposeRenderer = r.dispose;
    this.earth = buildEarth(this.scene);
    this.ctl = orbitControls(host, this.camera, 4.2);

    // Marcador del seleccionado
    this.marker = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
    this.marker.add(new THREE.Mesh(new THREE.RingGeometry(0.03, 0.037, 40), ringMat));
    this.marker.visible = false;
    this.scene.add(this.marker);

    let downX = 0, downY = 0, lastHover = 0;
    host.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
    host.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // fue un arrastre
      const i = this.pickIndex(e.clientX, e.clientY);
      this.select(i);
      this.onPick(i >= 0 ? this.sats[i].omm.NORAD_CAT_ID : null);
    });
    host.addEventListener("pointermove", (e) => {
      const now = performance.now();
      if (now - lastHover < 80 || e.buttons) return;
      lastHover = now;
      const i = this.pickIndex(e.clientX, e.clientY);
      const rect = host.getBoundingClientRect();
      this.onHover(i >= 0 ? this.sats[i].omm.OBJECT_NAME : null, e.clientX - rect.left, e.clientY - rect.top);
      host.style.cursor = i >= 0 ? "pointer" : "grab";
    });
    this.raf = requestAnimationFrame(this.loop);
  }

  setSatellites(list: EngineSat[], keepNorad?: number | null) {
    this.sats = list;
    const n = list.length;
    this.cursor = 0; // la lista puede encoger (al desmarcar un grupo): nunca apuntar fuera de rango
    this.selected = -1;
    this.recs = list.map((s) => { try { return json2satrec(s.omm as never) as SatRec; } catch { return null; } });
    this.anchor = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.tAnchor = new Float64Array(n);
    this.pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const shape = new Float32Array(n);
    list.forEach((s, i) => { const c = new THREE.Color(s.color); col.set([c.r, c.g, c.b], i * 3); shape[i] = ICON_KINDS.indexOf(s.icon); });
    const now = this.simMs;
    for (let i = 0; i < n; i++) this.reanchor(i, now);
    this.geo.dispose();
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.geo.setAttribute("shape", new THREE.BufferAttribute(shape, 1));
    if (this.points) this.scene.remove(this.points);
    if (!this.atlas) {
      this.atlas = new THREE.CanvasTexture(buildAtlas());
      this.atlas.colorSpace = THREE.SRGBColorSpace;
    }
    // Iconos por tipo (atlas 4×2), tamaño en pantalla con perspectiva y mínimo legible
    this.material?.dispose();
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { atlas: { value: this.atlas }, size: { value: n > 3000 ? 0.045 : n > 600 ? 0.075 : 0.13 }, minPx: { value: n > 3000 ? 6 : n > 600 ? 10 : 16 }, scale: { value: this.host.clientHeight / 2 } },
      vertexShader: `
        attribute float shape; attribute vec3 color; varying vec3 vColor; varying float vShape; uniform float size; uniform float scale; uniform float minPx;
        void main() {
          vColor = color; vShape = shape;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * scale / -mv.z, minPx, 44.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D atlas; varying vec3 vColor; varying float vShape;
        void main() {
          vec2 cell = vec2(mod(vShape, 4.0), floor(vShape / 4.0));
          vec2 uv = (cell + vec2(gl_PointCoord.x, gl_PointCoord.y)) / vec2(4.0, 2.0);
          vec4 t = texture2D(atlas, uv);
          if (t.a < 0.25) discard;
          gl_FragColor = vec4(vColor, t.a);
        }`,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.scene.add(this.points);
    // Encuadre: la cámara se ajusta al 85 % de los objetos (unos pocos en órbita alta no alejan la vista)
    const radii: number[] = [];
    for (let i = 0; i < n; i++) { const j = i * 3; const r = Math.hypot(this.anchor[j], this.anchor[j + 1], this.anchor[j + 2]); if (r > 0) radii.push(r); }
    radii.sort((a, b) => a - b);
    const p85 = radii.length ? radii[Math.floor(radii.length * 0.85)] : 1.1;
    this.ctl.setDistance(Math.min(Math.max(p85 * 2.7, 3.2), 16));
    const idx = keepNorad ? list.findIndex((s) => s.omm.NORAD_CAT_ID === keepNorad) : -1;
    this.select(idx);
  }

  /** Recalcula con SGP4 posición y velocidad reales en `t`. */
  private reanchor(i: number, t: number) {
    const rec = this.recs[i];
    const pv = rec ? propagate(rec, new Date(t)) : null;
    if (!pv?.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") {
      this.anchor.set([0, 0, 0], i * 3); this.vel.set([0, 0, 0], i * 3); this.tAnchor[i] = t;
      return;
    }
    const p = eciToThree(pv.position), v = pv.velocity;
    this.anchor.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x / RE, v.z / RE, -v.y / RE], i * 3);
    this.tAnchor[i] = t;
  }

  private loop = () => {
    const real = Date.now();
    this.simMs = this.warp === 1 ? real : this.simMs + (real - this.lastReal) * this.warp;
    this.lastReal = real;
    const now = this.simMs;
    const n = this.sats.length;
    // Re-anclaje escalonado: cada satélite pasa por SGP4 aproximadamente una vez por segundo
    const batch = Math.min(n, Math.max(40, Math.ceil((n / 60) * Math.min(this.warp, 20))));
    for (let k = 0; k < batch && n; k++) { this.cursor %= n; this.reanchor(this.cursor, now); this.cursor = (this.cursor + 1) % n; }
    for (let i = 0; i < n; i++) {
      const dt = (now - this.tAnchor[i]) / 1000, j = i * 3;
      this.pos[j] = this.anchor[j] + this.vel[j] * dt;
      this.pos[j + 1] = this.anchor[j + 1] + this.vel[j + 1] * dt;
      this.pos[j + 2] = this.anchor[j + 2] + this.vel[j + 2] * dt;
    }
    if (n) { this.geo.attributes.position.needsUpdate = true; this.geo.computeBoundingSphere(); }
    this.earth.rotation.y = gstime(new Date(now));
    if (this.selected >= 0) {
      const j = this.selected * 3;
      this.marker.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      this.marker.lookAt(this.camera.position);
    }
    if (this.material) this.material.uniforms.scale.value = this.host.clientHeight / 2;
    this.ctl.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private pickIndex(cx: number, cy: number) {
    if (!this.points) return -1;
    const rect = this.host.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.params.Points = { threshold: 0.012 * this.camera.position.length() };
    const hits = this.raycaster.intersectObject(this.points);
    // Descarta los que están detrás de la Tierra
    const earthHit = this.raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), new THREE.Vector3());
    const dEarth = earthHit ? earthHit.distanceTo(this.camera.position) : Infinity;
    const h = hits.find((x) => x.distance < dEarth);
    return h?.index ?? -1;
  }

  select(i: number) {
    this.selected = i;
    this.marker.visible = i >= 0;
    if (this.orbitLine) { this.scene.remove(this.orbitLine); this.orbitLine.geometry.dispose(); this.orbitLine = null; }
    const rec = i >= 0 ? this.recs[i] : null;
    if (!rec) return;
    const period = (1440 / this.sats[i].omm.MEAN_MOTION) * 60_000, t0 = this.simMs, pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 200; k++) {
      const pv = propagate(rec, new Date(t0 + (period * k) / 200));
      if (pv?.position && typeof pv.position !== "boolean") pts.push(eciToThree(pv.position));
    }
    this.orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: this.sats[i].color, transparent: true, opacity: 0.8 }));
    this.scene.add(this.orbitLine);
  }

  selectNorad(norad: number | null) {
    this.select(norad ? this.sats.findIndex((s) => s.omm.NORAD_CAT_ID === norad) : -1);
  }

  /** Estado en vivo del satélite seleccionado. */
  live(norad: number): LiveInfo | null {
    const i = this.sats.findIndex((s) => s.omm.NORAD_CAT_ID === norad);
    const rec = i >= 0 ? this.recs[i] : null;
    if (!rec) return null;
    const d = new Date(this.simMs);
    const pv = propagate(rec, d);
    if (!pv?.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
    const g = eciToGeodetic(pv.position, gstime(d));
    const s = this.sats[i];
    return { norad, name: s.omm.OBJECT_NAME, group: s.group, lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), alt: g.height, speed: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) };
  }

  /** Controles de la vista y del tiempo. */
  setWarp(w: number) {
    if (w === 1) this.simMs = Date.now();
    this.warp = w;
    // Re-anclar todo al cambiar de ritmo para que no haya saltos
    for (let i = 0; i < this.sats.length; i++) this.reanchor(i, this.simMs);
  }
  get time() { return this.simMs; }
  setAutoRotate(v: boolean) { this.ctl.setAuto(v); }
  get autoRotate() { return this.ctl.auto; }
  zoomBy(f: number) { this.ctl.zoomBy(f); }
  resetView() { this.ctl.reset(); }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ctl.dispose();
    this.geo.dispose();
    this.material?.dispose();
    this.atlas?.dispose();
    this.disposeRenderer();
  }
}
