"use client";

import { useSyncExternalStore } from "react";

// Reloj compartido: un solo intervalo para todas las cuentas regresivas.
let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribeClock(cb: () => void) {
  subs.add(cb);
  if (!timer) timer = setInterval(() => { now = Date.now(); subs.forEach((s) => s()); }, 1000);
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearInterval(timer); timer = null; }
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
  const subscribe = (cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(`net:${key}`, cb);
    return () => { window.removeEventListener("storage", cb); window.removeEventListener(`net:${key}`, cb); };
  };
  const read = () => { try { return localStorage.getItem(key) === "1"; } catch { return false; } };
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = (v: boolean) => {
    try { localStorage.setItem(key, v ? "1" : "0"); } catch {}
    window.dispatchEvent(new Event(`net:${key}`));
  };
  return [value, set];
}
