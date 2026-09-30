"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { json2satrec, propagate, gstime, type SatRec } from "@/lib/sgp4";
import type { OMM } from "@/lib/orbit";
import { buildEarth, eciToThree, makeRenderer, orbitControls } from "./earth";

// Clases orbitales (color por clase, validado para daltonismo con el fondo grafito)
export const ORBIT_COLORS = { LEO: "#ff5b1f", MEO: "#f5b83d", GEO: "#ecebe6", HEO: "#8f8b82" } as const;
export type OrbitKey = keyof typeof ORBIT_COLORS;

export function classify(o: OMM): OrbitKey {
  const n = (o.MEAN_MOTION * 2 * Math.PI) / 86400;
  const a = Math.cbrt(398600.4418 / (n * n));
  const apo = a * (1 + o.ECCENTRICITY) - 6378, per = a * (1 - o.ECCENTRICITY) - 6378;
  if (apo < 2000) return "LEO";
  if (Math.abs(1440 / o.MEAN_MOTION - 1436) < 30 && o.ECCENTRICITY < 0.05) return "GEO";
  if (per < 2000 && apo > 20000) return "HEO";
  return "MEO";
}

/** Toda una constelación en 3D. Posiciones CALCULADAS (SGP4), recalculadas cada 2 s. */
export function ConstellationGlobe({ objects, height = 520 }: { objects: OMM[]; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const sats: { rec: SatRec; cls: OrbitKey }[] = [];
    for (const o of objects) {
      try { sats.push({ rec: json2satrec(o as never) as SatRec, cls: classify(o) }); } catch { /* elementos inválidos */ }
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
    const { renderer, dispose } = makeRenderer(el, camera);
    const earth = buildEarth(scene);

    const pos = new Float32Array(sats.length * 3);
    const col = new Float32Array(sats.length * 3);
    sats.forEach((s, i) => { const c = new THREE.Color(ORBIT_COLORS[s.cls]); col.set([c.r, c.g, c.b], i * 3); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: sats.length > 2000 ? 0.012 : 0.022, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    scene.add(pts);

    const hasFar = sats.some((s) => s.cls === "GEO" || s.cls === "MEO" || s.cls === "HEO");
    const ctl = orbitControls(el, camera, hasFar ? 13 : 3.4);

    const update = () => {
      const d = new Date();
      let ok = 0;
      sats.forEach((s, i) => {
        const pv = propagate(s.rec, d);
        if (pv?.position && typeof pv.position !== "boolean") {
          const v = eciToThree(pv.position);
          pos.set([v.x, v.y, v.z], i * 3);
          ok++;
        } else pos.set([0, 0, 0], i * 3);
      });
      geo.attributes.position.needsUpdate = true;
      geo.computeBoundingSphere();
      earth.rotation.y = gstime(d);
      setCount(ok);
    };
    update();
    const iv = setInterval(update, 2000);

    let raf = 0;
    const loop = () => { ctl.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { clearInterval(iv); cancelAnimationFrame(raf); ctl.dispose(); dispose(); };
  }, [objects]);

  return (
    <div className="relative">
      <div ref={host} style={{ height }} className="w-full cursor-grab touch-none active:cursor-grabbing" role="img" aria-label="Constelación de satélites alrededor de la Tierra" />
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-line bg-bg/80 p-2.5 text-[11px] backdrop-blur">
        <p className="num text-fg">{count.toLocaleString("es")} objetos</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(ORBIT_COLORS) as OrbitKey[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-fg-muted"><span className="size-2 rounded-full" style={{ background: ORBIT_COLORS[k] }} />{k}</span>
          ))}
        </div>
      </div>
      <p className="pointer-events-none px-3 pb-3 text-[10.5px] text-fg-dim md:absolute md:right-3 md:bottom-3 md:max-w-xs md:p-0 md:text-right">
        Posiciones calculadas (SGP4) con elementos de CelesTrak; se actualizan cada 2 s. Arrastra para girar, rueda para acercar.
      </p>
    </div>
  );
}
