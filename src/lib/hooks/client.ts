"use client";

import { useCallback, useSyncExternalStore } from "react";

// Reloj compartido: un solo temporizador para todas las cuentas regresivas, alineado al
// cambio de segundo (sin deriva: el contador nunca se salta un segundo).
let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
function tick() {
  now = Date.now();
  subs.forEach((s) => s());
  timer = setTimeout(tick, 1000 - (Date.now() % 1000));
}
function subscribeClock(cb: () => void) {
  subs.add(cb);
  if (!timer) { now = Date.now(); timer = setTimeout(tick, 1000 - (now % 1000)); }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearTimeout(timer); timer = null; }
  };
}
/** Hora actual (ms) en el cliente; null durante SSR/hidratación. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, () => now, () => null);
}

const noop = () => () => {};
/** Zona horaria del navegador; null en el servidor. */
export function useTimeZone(): string | null {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}

/** Preferencia booleana persistida en localStorage (tolerante a fallos). */
export function useStoredFlag(key: string): [boolean, (v: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(`net:${key}`, cb);
    return () => { window.removeEventListener("storage", cb); window.removeEventListener(`net:${key}`, cb); };
  }, [key]);
  const read = useCallback(() => { try { return localStorage.getItem(key) === "1"; } catch { return false; } }, [key]);
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = (v: boolean) => {
    try { localStorage.setItem(key, v ? "1" : "0"); } catch {}
    window.dispatchEvent(new Event(`net:${key}`));
  };
  return [value, set];
}
