"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

export type GlobeTarget = { lat: number; lng: number; dist: number; shiftX: number; dim: number } | null;
export type GlobeHandle = { setTarget: (t: GlobeTarget) => void; setShift: (x: number) => void };
type Pad = { lat: number; lng: number; total: number; upcoming: number };

const ll = (lon: number, lat: number, r = 1) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

/** Textura circular generada en tiempo de ejecución (sin descargar imágenes). */
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Globo de la portada: continentes reales (Natural Earth) y plataformas reales (LL2). */
export const GlobeStage = forwardRef<GlobeHandle, { pads: Pad[] }>(function GlobeStage({ pads }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ target: null as GlobeTarget, shiftX: 0.55 });

  useImperativeHandle(ref, () => ({
    setTarget: (t) => { state.current.target = t; },
    setShift: (x) => { state.current.shiftX = x; },
  }));

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
    el.style.overflow = "hidden";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    camera.position.set(0, 0, 4.2);

    const tilt = new THREE.Group(); // latitud
    const spin = new THREE.Group(); // longitud
    tilt.add(spin);
    scene.add(tilt);

    // Núcleo y borde de "ignición" (fresnel)
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({ color: 0x0f0f0e })));
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 96, 64),
      new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { c: { value: new THREE.Color(0xff5b1f) } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.0); gl_FragColor = vec4(c, f*0.28); }`,
      }),
    );
    scene.add(rim);

    // Retícula
    const gridMat = new THREE.LineBasicMaterial({ color: 0x23231f, transparent: true, opacity: 0.9 });
    for (let lat = -60; lat <= 60; lat += 30) spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 121 }, (_, i) => ll(i * 3 - 180, lat, 1.001))), gridMat));
    for (let lon = -180; lon < 180; lon += 30) spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, (_, i) => ll(lon, i * 3 - 90, 1.001))), gridMat));

    // Continentes
    let alive = true;
    import("world-atlas/land-110m.json").then((m) => {
      if (!alive) return; // la escena ya se desmontó
      const topo = (m.default ?? m) as unknown as Topology;
      const land = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
      const mat = new THREE.LineBasicMaterial({ color: 0x8f8b82, transparent: true, opacity: 0.75 });
      for (const f of land.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
        for (const poly of polys) for (const ring of poly) spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]) => ll(lo, la, 1.002))), mat));
      }
    });

    // Plataformas reales
    const tex = dotTexture();
    const mkPoints = (list: Pad[], color: number, base: number) => {
      const g = new THREE.BufferGeometry().setFromPoints(list.map((p) => ll(p.lng, p.lat, 1.006)));
      const m = new THREE.PointsMaterial({ color, size: base, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      spin.add(new THREE.Points(g, m));
      return m;
    };
    const hot = pads.filter((p) => p.upcoming > 0);
    mkPoints(pads.filter((p) => p.upcoming === 0), 0xa6a39a, 0.035);
    const hotMat = mkPoints(hot, 0xff5b1f, 0.075);
    // Columnas de actividad (altura ∝ lanzamientos programados)
    const maxUp = Math.max(1, ...hot.map((p) => p.upcoming));
    const barMat = new THREE.LineBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.7 });
    for (const p of hot) spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([ll(p.lng, p.lat, 1.004), ll(p.lng, p.lat, 1.02 + 0.22 * Math.sqrt(p.upcoming / maxUp))]), barMat));

    // Resaltado de la base activa (recorrido)
    const hl = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.036, 48), ringMat);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.056, 48), ringMat.clone());
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.8 }));
    beam.position.z = 0.175; beam.rotation.x = Math.PI / 2;
    hl.add(ring, ring2, core, beam);
    hl.visible = false;
    spin.add(hl);
    let hlKey = "";

    // Campo de estrellas tenue (decorativo, sin datos)
    const starG = new THREE.BufferGeometry();
    const n = mobile ? 600 : 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    starG.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xecebe6, size: 0.12, map: tex, transparent: true, opacity: 0.35, depthWrite: false })));

    const resize = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Bucle: interpola hacia el objetivo (o gira libremente)
    let raf = 0, idle = -0.6, shift = state.current.shiftX, dist = 4.2, yOff = mobile ? 0.9 : 0, t0 = performance.now();
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const angLerp = (a: number, b: number, k: number) => a + (Math.atan2(Math.sin(b - a), Math.cos(b - a))) * k;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const t = state.current.target;
      const key = t ? `${t.lat},${t.lng}` : "";
      if (key !== hlKey) {
        hlKey = key;
        hl.visible = !!t;
        if (t) {
          const p = ll(t.lng, t.lat, 1.008);
          hl.position.copy(p);
          spin.updateMatrixWorld(true);
          hl.lookAt(spin.localToWorld(p.clone().multiplyScalar(2)));
        }
      }
      if (hl.visible) {
        const k = (now % 1600) / 1600;
        ring2.scale.setScalar(1 + k * 1.8);
        (ring2.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      }
      if (t) {
        spin.rotation.y = angLerp(spin.rotation.y, -Math.PI / 2 - (t.lng * Math.PI) / 180, 2.2 * dt);
        tilt.rotation.x = lerp(tilt.rotation.x, (t.lat * Math.PI) / 180, 2.2 * dt);
        dist = lerp(dist, mobile ? Math.max(t.dist, 3.4) : t.dist, 2 * dt);
        idle = spin.rotation.y;
      } else {
        if (!reduce) idle += dt * 0.06;
        spin.rotation.y = angLerp(spin.rotation.y, idle, 2 * dt);
        tilt.rotation.x = lerp(tilt.rotation.x, 0.35, 1.5 * dt);
        dist = lerp(dist, mobile ? 5.2 : 4.2, 1.5 * dt);
      }
      shift = lerp(shift, mobile ? 0 : (t?.shiftX ?? state.current.shiftX), 2.5 * dt);
      // Móvil: en el hero el globo queda bajo el texto (y +0.9); en el recorrido la base resaltada
      // sube a la mitad superior de la pantalla, por encima de la tarjeta inferior (y −0.3).
      yOff = lerp(yOff, mobile ? (t ? -0.3 : 0.9) : 0, 2.5 * dt);
      camera.position.set(-shift * dist * 0.35, yOff, dist);
      camera.lookAt(-shift * dist * 0.35, yOff, 0);
      hotMat.size = 0.075 * (1 + 0.18 * Math.sin(now / 420));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      // Liberar GPU: geometrías, materiales, textura y el propio contexto WebGL (si no, cada visita suma uno).
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x?.dispose());
      });
      tex.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, [pads]);

  return <div ref={host} className="size-full" aria-hidden />;
});
