// Pasos de satélites sobre un observador (SGP4 en el navegador). Compartido por "En el espacio" y "Esta noche".
import { propagate, gstime, eciToEcf, ecfToLookAngles, degreesToRadians, jday, sunPos, shadowFraction, type SatRec } from "@/lib/sgp4";

const AU = 149597870.7;

export type Pass = { start: Date; peak: Date; end: Date; maxEl: number; azStart: number; azPeak: number; azEnd: number; visible: boolean };
const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const dir = (az: number) => DIRS[Math.round(az / 45) % 8];

/** Elevación del Sol (grados) para un observador, con el modelo solar de satellite.js. */
export function sunElevation(d: Date, obs: { lat: number; lon: number }) {
  const observer = { latitude: degreesToRadians(obs.lat), longitude: degreesToRadians(obs.lon), height: 0 };
  const sun = sunPos(jday(d)).rsun;
  const g = gstime(d);
  return (ecfToLookAngles(observer, eciToEcf({ x: sun.x * AU, y: sun.y * AU, z: sun.z * AU }, g)).elevation * 180) / Math.PI;
}

/**
 * Pasos con elevación > minEl entre `from` y `to`. Visible = satélite iluminado por el Sol y cielo oscuro (Sol < −6°)
 * en algún momento del paso. Paso de `step` segundos.
 */
export function computePasses(rec: SatRec, obs: { lat: number; lon: number }, opts: { from?: number; to?: number; hours?: number; step?: number; minEl?: number; max?: number } = {}): Pass[] {
  const observer = { latitude: degreesToRadians(obs.lat), longitude: degreesToRadians(obs.lon), height: 0 };
  const from = opts.from ?? Date.now();
  const to = opts.to ?? from + (opts.hours ?? 72) * 3600_000;
  const step = (opts.step ?? 20) * 1000;
  const minEl = opts.minEl ?? 10;
  const max = opts.max ?? 10;
  const out: Pass[] = [];
  let cur: Pass | null = null;
  for (let t = from; t < to; t += step) {
    const d = new Date(t);
    const pv = propagate(rec, d);
    if (!pv?.position || typeof pv.position === "boolean") continue;
    const g = gstime(d);
    const la = ecfToLookAngles(observer, eciToEcf(pv.position, g));
    const el = (la.elevation * 180) / Math.PI, az = ((la.azimuth * 180) / Math.PI + 360) % 360;
    if (el > minEl) {
      const sun = sunPos(jday(d)).rsun;
      const sunEl = (ecfToLookAngles(observer, eciToEcf({ x: sun.x * AU, y: sun.y * AU, z: sun.z * AU }, g)).elevation * 180) / Math.PI;
      const vis = shadowFraction(sun, pv.position) < 0.5 && sunEl < -6;
      if (!cur) cur = { start: d, peak: d, end: d, maxEl: el, azStart: az, azPeak: az, azEnd: az, visible: vis };
      if (vis) cur.visible = true;
      if (el > cur.maxEl) { cur.maxEl = el; cur.peak = d; cur.azPeak = az; }
      cur.end = d; cur.azEnd = az;
    } else if (cur) {
      out.push(cur);
      cur = null;
      if (out.length >= max) break;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Trayectoria de un paso en el cielo del observador (elevación/acimut cada `stepS` segundos). */
export function passTrack(rec: SatRec, obs: { lat: number; lon: number }, from: number, to: number, stepS = 10) {
  const observer = { latitude: degreesToRadians(obs.lat), longitude: degreesToRadians(obs.lon), height: 0 };
  const out: { t: number; el: number; az: number }[] = [];
  for (let t = from - 60_000; t <= to + 60_000; t += stepS * 1000) {
    const d = new Date(t);
    const pv = propagate(rec, d);
    if (!pv?.position || typeof pv.position === "boolean") continue;
    const la = ecfToLookAngles(observer, eciToEcf(pv.position, gstime(d)));
    out.push({ t, el: (la.elevation * 180) / Math.PI, az: ((la.azimuth * 180) / Math.PI + 360) % 360 });
  }
  return out;
}
