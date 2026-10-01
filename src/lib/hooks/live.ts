"use client";

import { useCallback, useSyncExternalStore } from "react";

// Latido compartido: UNA sola petición a /api/live por página, aunque varios componentes muestren datos en vivo.
// Cada 60 s normalmente; cada 20 s desde T−10 min hasta T+3 h; en pausa si la pestaña está oculta.

export type LiveNext = {
  id: string; slug: string; name: string; missionName: string | null; statusAbbrev: string | null; statusName: string | null;
  net: string | null; netPrecision: string | null; webcastLive: boolean | null; rocketName: string | null; rocketFullName: string | null;
  providerName: string | null; providerType: string | null; locationName: string | null; padName: string | null; padId: number | null;
  countryCode: string | null; imageUrl: string | null; orbitName: string | null; missionType: string | null;
  watch: Watch | null;
};
export type Watch = { url: string; official: boolean; publisher: string | null };
export type LiveLaunchState = { statusAbbrev: string | null; statusName: string | null; net: string | null; netPrecision: string | null; webcastLive: boolean | null; failReason: string | null; watch: Watch | null };
export type LivePayload = { next: LiveNext | null; lastSync: string | null; serverTime: string; launch: LiveLaunchState | null };

let snapshot: LivePayload | null = null;
let slug: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function delay() {
  const net = snapshot?.next?.net ? new Date(snapshot.next.net).getTime() : null;
  const d = net === null ? Infinity : net - Date.now();
  return d < 10 * 60_000 && d > -3 * 3600_000 ? 20_000 : 60_000;
}

async function poll() {
  if (typeof document !== "undefined" && document.hidden) return schedule();
  const asked = slug;
  try {
    const r = await fetch(`/api/live${asked ? `?slug=${encodeURIComponent(asked)}` : ""}`, { cache: "no-store" });
    // Si mientras tanto se abrió otro lanzamiento, esta respuesta ya no vale (pediría su estado a continuación).
    if (asked !== slug) return poll();
    if (r.ok) {
      snapshot = await r.json();
      subs.forEach((s) => s());
    }
  } catch {
    /* sin conexión: se mantiene lo que se ve y se reintenta */
  }
  schedule();
}
function schedule() {
  if (timer) clearTimeout(timer);
  timer = subs.size ? setTimeout(poll, delay()) : null;
}
function onVisible() {
  if (!document.hidden) poll();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) {
    document.addEventListener("visibilitychange", onVisible);
    timer = setTimeout(poll, 1500); // primera actualización poco después de cargar
  }
  return () => {
    subs.delete(cb);
    if (!subs.size) {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

/** Datos en vivo (null hasta la primera respuesta: usar entonces los datos del servidor). */
export function useLive(forSlug?: string): LivePayload | null {
  const sub = useCallback((cb: () => void) => {
    if (forSlug && slug !== forSlug) {
      slug = forSlug;
      if (snapshot) snapshot = { ...snapshot, launch: null }; // el resto (próximo, última sync) sigue valiendo
      if (timer) { clearTimeout(timer); timer = setTimeout(poll, 300); } // estado del nuevo lanzamiento cuanto antes
    }
    const unsub = subscribe(cb);
    return () => {
      unsub();
      if (forSlug && slug === forSlug) slug = null; // al salir de la ficha, el latido deja de pedir ese lanzamiento
    };
  }, [forSlug]);
  return useSyncExternalStore(sub, () => snapshot, () => null);
}
