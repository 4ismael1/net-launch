// Clasificación orbital y época de los elementos (módulo plano: válido en servidor y cliente).
import type { OMM } from "@/lib/orbit";

// Clases orbitales (color por clase, validado para daltonismo con el fondo grafito)
export const ORBIT_COLORS = { LEO: "#ff5b1f", MEO: "#f5b83d", GEO: "#ecebe6", HEO: "#8f8b82" } as const;
export type OrbitKey = keyof typeof ORBIT_COLORS;

const MU = 398600.4418, RE = 6378.137;
/** Periodo (min), apogeo y perigeo (km) desde los elementos medios (aproximación kepleriana). */
export function orbitParams(o: OMM) {
  const n = (o.MEAN_MOTION * 2 * Math.PI) / 86400, a = Math.cbrt(MU / (n * n));
  return { period: 1440 / o.MEAN_MOTION, apo: a * (1 + o.ECCENTRICITY) - RE, per: a * (1 - o.ECCENTRICITY) - RE };
}

export function classify(o: OMM): OrbitKey {
  const { apo, per, period } = orbitParams(o);
  if (apo < 2000) return "LEO";
  if (Math.abs(period - 1436) < 30 && o.ECCENTRICITY < 0.05) return "GEO";
  if (per < 2000 && apo > 20000) return "HEO";
  return "MEO";
}

/** Época de los elementos (UTC, en español). null si no viene o no se puede leer: nunca se inventa. */
export function epochLabel(epoch: string | null | undefined) {
  if (!epoch) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(epoch) ? epoch : `${epoch}Z`);
  if (!Number.isFinite(t)) return null;
  return `${new Date(t).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/** Texto de procedencia de una posición calculada: una época, o el rango si hay varios objetos. */
export function sgp4Note(objects: Pick<OMM, "EPOCH">[]) {
  const ts = objects.map((o) => o.EPOCH).filter(Boolean).sort();
  const a = epochLabel(ts[0]), b = epochLabel(ts[ts.length - 1]);
  const base = "Posición calculada (SGP4) desde elementos orbitales";
  if (!a) return base;
  return a === b || !b ? `${base} · época ${a}` : `${base} · épocas del ${a} al ${b}`;
}
