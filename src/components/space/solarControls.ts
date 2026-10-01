import * as THREE from "three";

/**
 * Cámara orbital con objetivo móvil y transiciones suaves (amortiguadas) para el sistema solar 3D.
 * Mismos gestos que los globos (`orbit/earth.ts`): arrastre para girar, Ctrl/⌘ + rueda para acercar (la rueda sola
 * desplaza la página y avisa con `onHint`), pellizco con dos dedos; en táctil un dedo en vertical desplaza la página.
 * Además: toque/clic corto → `onTap`, ratón sin pulsar → `onHover`.
 */
export function solarControls(
  host: HTMLElement,
  camera: THREE.PerspectiveCamera,
  opts: { dist: number; minDist: number; maxDist: number; onHint?: () => void; onTap?: (x: number, y: number, touch: boolean) => void; onHover?: (x: number, y: number) => void; onLeave?: () => void },
) {
  const home = { az: -0.5, el: 0.55, dist: opts.dist };
  const goal = { az: home.az, el: home.el, dist: home.dist, target: new THREE.Vector3() };
  const cur = { az: home.az, el: home.el, dist: home.dist, target: new THREE.Vector3() };
  let { minDist, maxDist } = opts;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.style.touchAction = "pan-y";

  let px = 0, py = 0, pinch = 0, downX = 0, downY = 0, downT = 0, moved = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  const clamp = (d: number) => Math.max(minDist, Math.min(maxDist, d));
  const span = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const local = (e: PointerEvent | WheelEvent) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };

  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { host.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
    if (pointers.size === 1) { px = downX = e.clientX; py = downY = e.clientY; downT = performance.now(); moved = 0; }
    if (pointers.size === 2) { pinch = span(); moved = Infinity; }
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === "mouse") { const [x, y] = local(e); opts.onHover?.(x, y); }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const d = span();
      if (pinch > 0 && d > 0) goal.dist = clamp(goal.dist * (pinch / d));
      pinch = d;
      return;
    }
    moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    goal.az -= dx * 0.006;
    if (e.pointerType !== "touch") goal.el = Math.max(-1.45, Math.min(1.45, goal.el + dy * 0.006));
  };
  const up = (e: PointerEvent) => {
    const was = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 1) { const [p] = [...pointers.values()]; px = p.x; py = p.y; }
    if (was && e.type === "pointerup" && pointers.size === 0 && moved < 8 && performance.now() - downT < 600) {
      const [x, y] = local(e);
      opts.onTap?.(x, y, e.pointerType !== "mouse");
    }
  };
  const leave = () => opts.onLeave?.();
  const wheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) { opts.onHint?.(); return; }
    e.preventDefault();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    goal.dist = clamp(goal.dist * Math.exp(dy * 0.002));
  };
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("pointerleave", leave);
  host.addEventListener("wheel", wheel, { passive: false });

  return {
    goal,
    setLimits(min: number, max: number, homeDist: number) { minDist = min; maxDist = max; home.dist = homeDist; goal.dist = clamp(goal.dist); },
    zoomBy(f: number) { goal.dist = clamp(goal.dist * f); },
    /** Vuela hacia un punto (el objetivo puede seguir moviéndose: actualizar `goal.target` cada fotograma). */
    flyTo(target: THREE.Vector3, dist: number) { goal.target.copy(target); goal.dist = clamp(dist); },
    reset() { goal.az = home.az; goal.el = home.el; goal.dist = home.dist; goal.target.set(0, 0, 0); },
    get dist() { return cur.dist; },
    get dragging() { return pointers.size > 0; },
    /** Avanza la cámara hacia el objetivo; devuelve true si aún se está moviendo. */
    update(dt: number) {
      const k = reduce ? 1 : 1 - Math.exp(-dt / 140); // ~140 ms de constante de tiempo
      cur.az += (goal.az - cur.az) * Math.min(1, k * 2.2);
      cur.el += (goal.el - cur.el) * Math.min(1, k * 2.2);
      cur.dist = Math.exp(Math.log(cur.dist) + (Math.log(goal.dist) - Math.log(cur.dist)) * k);
      cur.target.lerp(goal.target, k);
      camera.position.set(
        cur.target.x + cur.dist * Math.cos(cur.el) * Math.sin(cur.az),
        cur.target.y + cur.dist * Math.sin(cur.el),
        cur.target.z + cur.dist * Math.cos(cur.el) * Math.cos(cur.az),
      );
      camera.lookAt(cur.target);
      const near = Math.max(1e-4, cur.dist * 0.01);
      if (Math.abs(camera.near - near) / near > 0.2) { camera.near = near; camera.far = cur.dist * 20 + 400; camera.updateProjectionMatrix(); }
      return Math.abs(goal.az - cur.az) > 1e-4 || Math.abs(goal.el - cur.el) > 1e-4 || Math.abs(Math.log(goal.dist / cur.dist)) > 1e-4 || cur.target.distanceTo(goal.target) > cur.dist * 1e-4;
    },
    dispose() {
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("wheel", wheel);
    },
  };
}
