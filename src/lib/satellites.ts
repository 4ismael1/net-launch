// Catálogo de satélites (CelesTrak GP + SATCAT). Datos públicos; posiciones calculadas en el navegador (SGP4).
// Política de CelesTrak: una descarga por actualización (cada 2 h) por grupo → caché ≥ 3 h y ninguna consulta desde el cliente.
import { cacheLife } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { OMM } from "./orbit";

export type GroupKey = keyof typeof GROUPS;
export type GroupCategory = "tripuladas" | "comunicaciones" | "navegacion" | "observacion" | "ciencia" | "otros";

export const CATEGORIES: Record<GroupCategory, string> = {
  tripuladas: "Estaciones y objetos destacados",
  comunicaciones: "Megaconstelaciones y comunicaciones",
  navegacion: "Navegación por satélite (GNSS)",
  observacion: "Meteorología y observación de la Tierra",
  ciencia: "Ciencia, radioaficionados y CubeSats",
  otros: "Otros",
};

export const GROUPS = {
  stations: { label: "Estaciones espaciales", cat: "tripuladas", desc: "ISS, Tiangong y los objetos asociados (módulos, naves acopladas)." },
  visual: { label: "Los 100 más brillantes", cat: "tripuladas", desc: "Satélites y etapas que suelen verse a simple vista desde tierra." },
  "last-30-days": { label: "Lanzados en los últimos 30 días", cat: "tripuladas", desc: "Objetos catalogados recientemente; enlazados con su lanzamiento." },
  starlink: { label: "Starlink", cat: "comunicaciones", desc: "Megaconstelación de SpaceX en órbita baja. Miles de satélites." },
  oneweb: { label: "OneWeb (Eutelsat)", cat: "comunicaciones", desc: "Constelación de banda ancha en órbita polar a ~1 200 km." },
  kuiper: { label: "Amazon Kuiper", cat: "comunicaciones", desc: "Constelación de banda ancha de Amazon (despliegue en curso)." },
  "iridium-NEXT": { label: "Iridium NEXT", cat: "comunicaciones", desc: "66 satélites de comunicaciones móviles con cobertura global." },
  geo: { label: "Geoestacionarios activos", cat: "comunicaciones", desc: "Satélites a ~35 786 km que giran al ritmo de la Tierra." },
  "gps-ops": { label: "GPS (EE. UU.)", cat: "navegacion", desc: "Constelación operativa del Sistema de Posicionamiento Global." },
  galileo: { label: "Galileo (UE)", cat: "navegacion", desc: "Sistema europeo de navegación por satélite." },
  beidou: { label: "BeiDou (China)", cat: "navegacion", desc: "Sistema chino de navegación, con satélites MEO, IGSO y GEO." },
  "glo-ops": { label: "GLONASS (Rusia)", cat: "navegacion", desc: "Sistema ruso de navegación por satélite." },
  weather: { label: "Meteorológicos", cat: "observacion", desc: "Satélites meteorológicos de distintas agencias." },
  noaa: { label: "NOAA", cat: "observacion", desc: "Satélites de la agencia atmosférica y oceánica de EE. UU." },
  resource: { label: "Recursos terrestres", cat: "observacion", desc: "Observación de la Tierra: Landsat, Sentinel, etc." },
  planet: { label: "Planet", cat: "observacion", desc: "Flota de pequeños satélites de imagen diaria de la Tierra." },
  science: { label: "Científicos", cat: "ciencia", desc: "Telescopios y misiones científicas en órbita terrestre (p. ej. Hubble)." },
  amateur: { label: "Radioaficionados", cat: "ciencia", desc: "Satélites accesibles para la comunidad de radioaficionados." },
  cubesat: { label: "CubeSats", cat: "ciencia", desc: "Nanosatélites estandarizados, muchos de universidades." },
} as const satisfies Record<string, { label: string; cat: GroupCategory; desc: string }>;

export const isGroup = (g: string): g is GroupKey => g in GROUPS;

export const FEATURED = [
  { norad: 25544, name: "ISS", note: "Estación Espacial Internacional" },
  { norad: 48274, name: "Tiangong", note: "Estación espacial china (CSS)" },
  { norad: 20580, name: "Hubble", note: "Telescopio espacial" },
  { norad: 43013, name: "NOAA-20", note: "Satélite meteorológico polar" },
  { norad: 41866, name: "GOES-16", note: "Meteorológico geoestacionario" },
  { norad: 39084, name: "Landsat 8", note: "Observación de la Tierra" },
];

async function gp(query: string): Promise<OMM[] | null> {
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?${query}&FORMAT=JSON`, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "NET-academic-launch-monitor" },
    });
    if (!res.ok) return null;
    const t = await res.text();
    return t.trim().startsWith("[") ? (JSON.parse(t) as OMM[]) : [];
  } catch {
    return null;
  }
}

export async function getGroup(key: GroupKey) {
  "use cache";
  cacheLife({ stale: 3 * 3600, revalidate: 3 * 3600, expire: 24 * 3600 });
  return gp(`GROUP=${encodeURIComponent(key)}`);
}

export async function getSatellite(norad: number) {
  "use cache";
  cacheLife({ stale: 3 * 3600, revalidate: 3 * 3600, expire: 24 * 3600 });
  const [elems, meta] = await Promise.all([
    gp(`CATNR=${norad}`),
    fetch(`https://celestrak.org/satcat/records.php?CATNR=${norad}&FORMAT=JSON`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.text() : "[]"))
      .then((t) => (t.trim().startsWith("[") ? (JSON.parse(t) as SatcatRecord[]) : []))
      .catch(() => [] as SatcatRecord[]),
  ]);
  return { omm: elems?.[0] ?? null, meta: meta[0] ?? null, unavailable: elems === null };
}

/** Búsqueda por nombre en el catálogo GP (mín. 3 letras). */
export async function searchSatellites(q: string) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 });
  const clean = q.replace(/[^\w\s()\-./]/g, "").trim();
  if (clean.length < 3) return [];
  if (/^\d{1,6}$/.test(clean)) return (await gp(`CATNR=${clean}`)) ?? [];
  return ((await gp(`NAME=${encodeURIComponent(clean)}`)) ?? []).slice(0, 60);
}

export type SatcatRecord = {
  OBJECT_NAME: string; OBJECT_ID: string; NORAD_CAT_ID: number; OBJECT_TYPE: string; OPS_STATUS_CODE: string; OWNER: string;
  LAUNCH_DATE: string; LAUNCH_SITE: string; DECAY_DATE: string; PERIOD: number; INCLINATION: number; APOGEE: number; PERIGEE: number;
  RCS: number | null; ORBIT_CENTER: string; ORBIT_TYPE: string;
};

export const OBJECT_TYPES: Record<string, string> = { PAY: "Carga útil", "R/B": "Etapa de cohete", DEB: "Desecho", UNK: "Desconocido" };
export const OPS_STATUS: Record<string, string> = {
  "+": "Operativo", "-": "No operativo", P: "Parcialmente operativo", B: "En reserva", S: "Repuesto", X: "Extendido", D: "Decaído", "?": "Desconocido",
};

/** Lanzamiento de nuestra BD que corresponde al designador internacional del objeto (yyyy-nnnX → yyyy-nnn). */
export async function launchForObject(objectId: string | null | undefined) {
  "use cache";
  cacheLife("hours");
  const m = objectId && /^(\d{4}-\d{3})/.exec(objectId);
  if (!m) return null;
  const { rows } = await db.execute<{ slug: string; name: string }>(sql`SELECT slug, name FROM launches WHERE launch_designator = ${m[1]} LIMIT 1`);
  return rows[0] ?? null;
}
