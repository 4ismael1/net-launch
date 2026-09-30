// Objetos catalogados públicamente (CelesTrak GP, formato OMM JSON).
// Política de CelesTrak: datos cada 2 h, bloqueo por exceso de errores → caché larga y cero reintentos.
import { cacheLife } from "next/cache";

export type OMM = {
  OBJECT_NAME: string; OBJECT_ID: string; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number;
  RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number; EPHEMERIS_TYPE: number; CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number; ELEMENT_SET_NO: number; REV_AT_EPOCH: number; BSTAR: number; MEAN_MOTION_DOT: number; MEAN_MOTION_DDOT: number;
};

async function fetchGP(query: string): Promise<OMM[] | null> {
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?${query}&FORMAT=JSON`, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "NET-academic-launch-monitor" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith("[")) return []; // "No GP data found"
    return JSON.parse(text) as OMM[];
  } catch {
    return null;
  }
}

/** Objetos de un lanzamiento por designador internacional (yyyy-nnn). null = servicio no disponible. */
export async function getLaunchObjects(designator: string) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 6 * 3600, expire: 24 * 3600 });
  if (!/^\d{4}-\d{3}$/.test(designator)) return [];
  return fetchGP(`INTDES=${designator}`);
}

/** Estaciones tripuladas: ISS (25544) y Tiangong (48274). */
export async function getStationsGP() {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 6 * 3600, expire: 24 * 3600 });
  const [iss, css] = await Promise.all([fetchGP("CATNR=25544"), fetchGP("CATNR=48274")]);
  return [...(iss ?? []), ...(css ?? [])];
}

const MU = 398600.4418; // km³/s²
const RE = 6378.137;
/** Parámetros derivados de los elementos medios (aproximación kepleriana). */
export function derived(o: OMM) {
  const n = (o.MEAN_MOTION * 2 * Math.PI) / 86400; // rad/s
  const a = Math.cbrt(MU / (n * n));
  return {
    periodMin: 1440 / o.MEAN_MOTION,
    apogeeKm: a * (1 + o.ECCENTRICITY) - RE,
    perigeeKm: a * (1 - o.ECCENTRICITY) - RE,
  };
}

export function orbitClass(o: OMM) {
  const { perigeeKm, apogeeKm, periodMin } = derived(o);
  if (apogeeKm < 2000) return "LEO";
  if (Math.abs(periodMin - 1436) < 30 && o.ECCENTRICITY < 0.05) return "GEO";
  if (perigeeKm < 2000 && apogeeKm > 20000) return "HEO/GTO";
  return "MEO";
}
