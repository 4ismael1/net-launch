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

// Último resultado de gp(): CelesTrak responde 403 cuando ese conjunto ya se descargó desde esta IP y aún no se ha
// actualizado (cada 2 h). Reintentar pronto no sirve y CelesTrak bloquea las IP insistentes → caché de espera larga.
let lastThrottled = false;
async function gp(query: string): Promise<OMM[] | null> {
  lastThrottled = false;
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?${query}&FORMAT=JSON`, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "NET-academic-launch-monitor" },
    });
    if (!res.ok) { lastThrottled = res.status === 403; return null; }
    const t = await res.text();
    return t.trim().startsWith("[") ? (JSON.parse(t) as OMM[]) : [];
  } catch {
    return null;
  }
}

// Caché normal (≥ 3 h, política de CelesTrak) y caché corta si CelesTrak falla, para reintentar pronto
const OK = { stale: 3 * 3600, revalidate: 3 * 3600, expire: 24 * 3600 };
const FAIL = { stale: 60, revalidate: 300, expire: 600 };
const THROTTLED = { stale: 600, revalidate: 3600, expire: 7200 };

export async function getGroup(key: GroupKey) {
  "use cache";
  const r = await gp(`GROUP=${encodeURIComponent(key)}`);
  cacheLife(r ? OK : lastThrottled ? THROTTLED : FAIL);
  return r;
}

export async function getSatellite(norad: number) {
  "use cache";
  const [elems, meta] = await Promise.all([
    gp(`CATNR=${norad}`),
    fetch(`https://celestrak.org/satcat/records.php?CATNR=${norad}&FORMAT=JSON`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => (t == null ? null : t.trim().startsWith("[") ? (JSON.parse(t) as SatcatRecord[]) : []))
      .catch(() => null),
  ]);
  cacheLife(elems === null || meta === null ? FAIL : OK);
  return { omm: elems?.[0] ?? null, meta: meta?.[0] ?? null, unavailable: elems === null };
}

/** Búsqueda por nombre en el catálogo GP (mín. 3 letras). */
export async function searchSatellites(q: string) {
  "use cache";
  const clean = q.replace(/[^\w\s()\-./]/g, "").trim();
  if (clean.length < 3) {
    cacheLife({ stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 });
    return [];
  }
  const r = /^\d{1,6}$/.test(clean) ? await gp(`CATNR=${clean}`) : await gp(`NAME=${encodeURIComponent(clean)}`);
  // Un fallo de CelesTrak no se guarda 3 h como "sin resultados"
  cacheLife(r ? { stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 } : FAIL);
  return r ? r.slice(0, 60) : null; // null = CelesTrak no responde (la ruta devuelve 503)
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

// ───────────── Población orbital en 3D ─────────────
// Conjuntos GP públicos de CelesTrak que incluyen objetos de todos los tipos. El catálogo completo (todas las etapas y
// fragmentos) no se publica en descargas abiertas por grupos: lo que no está aquí no se dibuja (nunca se inventan posiciones).
export const POPULATION_SOURCES = [
  { key: "active", query: "GROUP=active", label: "Satélites operativos" },
  { key: "gpz-plus", query: "SPECIAL=GPZ-PLUS", label: "Zona geoestacionaria (todos los objetos)" },
  { key: "last-30-days", query: "GROUP=last-30-days", label: "Lanzados en los últimos 30 días" },
  { key: "fengyun-1c-debris", query: "GROUP=fengyun-1c-debris", label: "Fragmentos de Fengyun-1C (2007)" },
  { key: "cosmos-2251-debris", query: "GROUP=cosmos-2251-debris", label: "Fragmentos de Cosmos 2251 (2009)" },
  { key: "iridium-33-debris", query: "GROUP=iridium-33-debris", label: "Fragmentos de Iridium 33 (2009)" },
  { key: "cosmos-1408-debris", query: "GROUP=cosmos-1408-debris", label: "Fragmentos de Cosmos 1408 (2021)" },
] as const;

/** Tipo de objeto: 0 carga útil, 1 etapa de cohete, 2 fragmento, 3 sin identificar (orden de OBJ_TYPES en satcat.ts). */
export type PopType = 0 | 1 | 2 | 3;
/** Fila compacta: [norad, nombre, designador, época, n, e, i, Ω, ω, M, B*, ṅ, n̈, tipo, operativo (0/1), fuente]. */
export type PopRow = [number, string, string, string, number, number, number, number, number, number, number, number, number, PopType, 0 | 1, number];
export type Population = { sources: { key: string; label: string; count: number | null }[]; rows: PopRow[] };

/** Tipo según la convención de nombres del catálogo (SATCAT): «R/B» etapas, «DEB» fragmentos, «OBJECT X»/«TBA» sin identificar. */
export function popTypeFromName(name: string): PopType {
  const n = name.toUpperCase();
  if (/\bR\/B\b|\bAKM\b|\bPKM\b/.test(n)) return 1;
  if (/\bDEB\b|\bCOOLANT\b/.test(n)) return 2;
  if (/^OBJECT [A-Z]{1,3}$|^TBA\b|^UNKNOWN\b/.test(n)) return 3;
  return 0;
}

/** CSV de CelesTrak → filas compactas. null si la respuesta no es un CSV de elementos (p. ej. aviso de límite de descargas). */
function parseGpCsv(text: string, src: number, operational: boolean): PopRow[] | null {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length || !lines[0].startsWith("OBJECT_NAME,")) return lines.length && /No GP data found/i.test(lines[0]) ? [] : null;
  const head = lines[0].split(",");
  const ix = (k: string) => head.indexOf(k);
  const I = {
    name: ix("OBJECT_NAME"), id: ix("OBJECT_ID"), epoch: ix("EPOCH"), mm: ix("MEAN_MOTION"), ecc: ix("ECCENTRICITY"), inc: ix("INCLINATION"),
    raan: ix("RA_OF_ASC_NODE"), argp: ix("ARG_OF_PERICENTER"), ma: ix("MEAN_ANOMALY"), norad: ix("NORAD_CAT_ID"), bstar: ix("BSTAR"),
    ndot: ix("MEAN_MOTION_DOT"), nddot: ix("MEAN_MOTION_DDOT"),
  };
  if (Object.values(I).some((v) => v < 0)) return null;
  const out: PopRow[] = [];
  for (let k = 1; k < lines.length; k++) {
    // Campos entre comillas (nombres con comas)
    const c: string[] = [];
    const l = lines[k];
    let cur = "", q = false;
    for (let j = 0; j < l.length; j++) {
      const ch = l[j];
      if (ch === '"') { if (q && l[j + 1] === '"') { cur += '"'; j++; } else q = !q; }
      else if (ch === "," && !q) { c.push(cur); cur = ""; }
      else cur += ch;
    }
    c.push(cur);
    const norad = Number(c[I.norad]), mm = Number(c[I.mm]);
    if (!Number.isInteger(norad) || !(mm > 0)) continue;
    const name = c[I.name].trim();
    out.push([
      norad, name, c[I.id] ?? "", c[I.epoch], mm, Number(c[I.ecc]), Number(c[I.inc]), Number(c[I.raan]), Number(c[I.argp]), Number(c[I.ma]),
      Number(c[I.bstar]) || 0, Number(c[I.ndot]) || 0, Number(c[I.nddot]) || 0, operational ? 0 : popTypeFromName(name), operational ? 1 : 0, src,
    ]);
  }
  return out;
}

async function getPopulationSource(i: number) {
  "use cache";
  const s = POPULATION_SOURCES[i];
  let rows: PopRow[] | null = null;
  let throttled = false;
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?${s.query}&FORMAT=CSV`, {
      signal: AbortSignal.timeout(25_000),
      headers: { "User-Agent": "NET-academic-launch-monitor" },
    });
    if (res.ok) rows = parseGpCsv(await res.text(), i, s.key === "active");
    else throttled = res.status === 403;
  } catch {
    rows = null;
  }
  cacheLife(rows ? OK : throttled ? THROTTLED : FAIL);
  return rows;
}

/** Objetos con elementos públicos para la vista 3D (sin duplicados; el primer conjunto que contiene un objeto manda). */
export async function getPopulation(): Promise<Population | null> {
  const lists = await Promise.all(POPULATION_SOURCES.map((_, i) => getPopulationSource(i)));
  if (lists.every((l) => !l)) return null;
  const seen = new Set<number>();
  const rows: PopRow[] = [];
  for (const l of lists) for (const r of l ?? []) if (!seen.has(r[0])) { seen.add(r[0]); rows.push(r); }
  return {
    sources: POPULATION_SOURCES.map((s, i) => ({ key: s.key, label: s.label, count: lists[i]?.length ?? null })),
    rows,
  };
}
