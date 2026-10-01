// Datos y cálculos compartidos del sistema solar (módulo plano: sin "use client").
// Planetas: modelo de astronomy-engine (VSOP87 abreviado; Plutón por integración numérica). Sondas: muestras de JPL Horizons.
import { Body, HelioState, RotateVector, Rotation_EQJ_ECL, Vector } from "astronomy-engine";
import type { Sample } from "@/lib/data/universe";

export const AU = 149_597_870.7;
export const C_KM_S = 299_792.458;

export type V3 = [number, number, number];
export type Planet = { b: Body; name: string; a: number; periodDays: number; color: string; px: number };

/** Colores cálidos/neutros (sin azules): los planetas se distinguen por tono y tamaño del punto, no a escala. */
export const PLANETS: Planet[] = [
  { b: Body.Mercury, name: "Mercurio", a: 0.387, periodDays: 87.969, color: "#a6a39a", px: 5 },
  { b: Body.Venus, name: "Venus", a: 0.723, periodDays: 224.701, color: "#d9c9a3", px: 7 },
  { b: Body.Earth, name: "Tierra", a: 1, periodDays: 365.256, color: "#ecebe6", px: 7.5 },
  { b: Body.Mars, name: "Marte", a: 1.524, periodDays: 686.98, color: "#c9785d", px: 6 },
  { b: Body.Jupiter, name: "Júpiter", a: 5.203, periodDays: 4332.59, color: "#d6b48c", px: 11 },
  { b: Body.Saturn, name: "Saturno", a: 9.537, periodDays: 10759.22, color: "#e0c98f", px: 10 },
  { b: Body.Uranus, name: "Urano", a: 19.19, periodDays: 30688.5, color: "#bdb8a8", px: 8.5 },
  { b: Body.Neptune, name: "Neptuno", a: 30.07, periodDays: 60182, color: "#9a958a", px: 8.5 },
  { b: Body.Pluto, name: "Plutón", a: 39.48, periodDays: 90560, color: "#8a7f72", px: 4.5 },
];

const ROT = Rotation_EQJ_ECL();

/** Posición heliocéntrica (km, eclíptica J2000) y velocidad respecto al Sol (km/s) de un planeta. */
export function planetState(b: Body, t: number): { pos: V3; speed: number } {
  const s = HelioState(b, new Date(t));
  const v = RotateVector(ROT, new Vector(s.x, s.y, s.z, s.t));
  return { pos: [v.x * AU, v.y * AU, v.z * AU], speed: (Math.hypot(s.vx, s.vy, s.vz) * AU) / 86400 };
}

/** Puntos de una vuelta completa centrada en `t` (km, eclíptica J2000). */
export function planetOrbit(p: Planet, t: number, steps = 256): V3[] {
  const P = p.periodDays * 864e5;
  const out: V3[] = [];
  for (let k = 0; k < steps; k++) out.push(planetState(p.b, t - P / 2 + (P * k) / steps).pos);
  return out;
}

/** Interpolación lineal de las muestras de Horizons (fuera del intervalo, se fija al extremo: úsese `inWindow`). */
export function interp(s: Sample[], t: number): V3 {
  let i = s.findIndex((x) => x[0] > t) - 1;
  if (i < 0) i = t < s[0][0] ? 0 : s.length - 2;
  const a = s[Math.max(0, i)], b = s[Math.min(s.length - 1, Math.max(0, i) + 1)];
  const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}
export const inWindow = (s: Sample[], t: number) => s.length > 1 && t >= s[0][0] && t <= s[s.length - 1][0];
/** Velocidad (km/s) por diferencia de la interpolación en un minuto. */
export const probeSpeed = (s: Sample[], t: number) => len(sub(interp(s, t + 60_000), interp(s, t))) / 60;

export const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const km = (v: number) => Math.round(v).toLocaleString("es");
export const au = (v: number) => (v / AU).toLocaleString("es", { maximumFractionDigits: v / AU < 10 ? 3 : 2 });
export function light(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s` : `${m} min ${String(s).padStart(2, "0")} s`;
}

/** Clave de selección compartida por la vista 3D, las tarjetas y la escalera: "sun", "b:<Body>" o "p:<id>". */
export type SelKey = string;
export const probeKey = (id: number) => `p:${id}`;
export const planetKey = (b: Body) => `b:${b}`;
