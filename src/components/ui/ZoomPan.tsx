"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

type View = { x: number; y: number; w: number };

/**
 * SVG con zoom y desplazamiento: Ctrl/⌘ + rueda o pellizco (trackpad y móvil), arrastre para moverse, doble clic para
 * acercar y botones. La rueda sola sigue desplazando la página. `children(k)` recibe el factor de zoom para que
 * textos, trazos y puntos conserven su tamaño en pantalla.
 */
export function ZoomPan({ w, h, maxZoom = 30, label, className, children }: { w: number; h: number; maxZoom?: number; label: string; className?: string; children: (k: number) => ReactNode }) {
  const svg = useRef<SVGSVGElement>(null);
  const [v, setV] = useState<View>({ x: 0, y: 0, w });
  const [hint, setHint] = useState(false);
  const k = w / v.w;
  const vh = (v.w * h) / w;

  const clamp = useCallback((nv: View): View => {
    const vw = Math.min(w, Math.max(w / maxZoom, nv.w)), vhh = (vw * h) / w;
    return { w: vw, x: Math.min(w - vw, Math.max(0, nv.x)), y: Math.min(h - vhh, Math.max(0, nv.y)) };
  }, [w, h, maxZoom]);

  // Punto de pantalla → coordenadas del dibujo
  const toSvg = useCallback((cx: number, cy: number, cur: View) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: cur.x + ((cx - r.left) / r.width) * cur.w, y: cur.y + ((cy - r.top) / r.height) * ((cur.w * h) / w) };
  }, [w, h]);

  const zoomAt = useCallback((f: number, cx?: number, cy?: number) => {
    setV((cur) => {
      const r = svg.current?.getBoundingClientRect();
      const p = cx != null && cy != null && r ? toSvg(cx, cy, cur) : { x: cur.x + cur.w / 2, y: cur.y + (cur.w * h) / w / 2 };
      const nw = cur.w / f;
      const fx = (p.x - cur.x) / cur.w, fy = (p.y - cur.y) / ((cur.w * h) / w);
      return clamp({ w: nw, x: p.x - fx * nw, y: p.y - fy * ((nw * h) / w) });
    });
  }, [clamp, toSvg, w, h]);

  // Rueda (con listener no pasivo para poder evitar el desplazamiento solo cuando se hace zoom)
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) { setHint(true); clearTimeout(t); t = setTimeout(() => setHint(false), 1200); return; }
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); clearTimeout(t); };
  }, [zoomAt]);

  // Arrastre y pellizco
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; d: number } | null>(null);
  const moved = useRef(false);
  const onDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (ptrs.current.size === 1 && k <= 1.001 && e.pointerType === "touch") return; // sin zoom: el dedo desplaza la página
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const prev = last.current;
    last.current = { x: cx, y: cy, d };
    if (!prev) return;
    if (pts.length > 1 && prev.d > 0) zoomAt(d / prev.d, cx, cy);
    if (pts.length === 1 && k <= 1.001) return;
    const r = svg.current!.getBoundingClientRect();
    const dx = ((cx - prev.x) / r.width) * v.w, dy = ((cy - prev.y) / r.height) * vh;
    if (Math.abs(cx - prev.x) + Math.abs(cy - prev.y) > 1) moved.current = true;
    setV((cur) => clamp({ ...cur, x: cur.x - dx, y: cur.y - dy }));
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); last.current = null; };

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg
        ref={svg}
        viewBox={`${v.x} ${v.y} ${v.w} ${vh}`}
        className="block w-full select-none"
        style={{ touchAction: k > 1.001 ? "none" : "pan-y", cursor: k > 1.001 ? "grab" : "default" }}
        role="img"
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => zoomAt(2, e.clientX, e.clientY)}
        // Un arrastre no debe contar como clic sobre los elementos (selección)
        onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); moved.current = false; } }}
      >
        {children(k)}
      </svg>
      <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-md border border-line bg-bg/80 backdrop-blur">
        <button type="button" onClick={() => zoomAt(1.6)} className="grid size-8 place-items-center text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Acercar"><Plus className="size-4" /></button>
        <button type="button" onClick={() => zoomAt(1 / 1.6)} disabled={k <= 1.001} className="grid size-8 place-items-center border-t border-line text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40" aria-label="Alejar"><Minus className="size-4" /></button>
        <button type="button" onClick={() => setV({ x: 0, y: 0, w })} disabled={k <= 1.001} className="grid size-8 place-items-center border-t border-line text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40" aria-label="Vista completa"><Maximize className="size-3.5" /></button>
      </div>
      {k > 1.001 && <span className="num pointer-events-none absolute bottom-2 left-2 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] text-fg-muted backdrop-blur">×{k < 10 ? k.toFixed(1) : Math.round(k)}</span>}
      <span className={`pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-bg/90 px-2.5 py-1 text-xs text-fg-muted shadow transition-opacity duration-300 ${hint ? "opacity-100" : "opacity-0"}`}>
        Ctrl o ⌘ + rueda para acercar · doble clic para ampliar
      </span>
    </div>
  );
}
