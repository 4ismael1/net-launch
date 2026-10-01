// Catálogos de LL2 guardados por el sincronizador (tabla `catalog`) + lo que ya traen los lanzamientos detallados.
// Programas, reutilización de propulsores, astronautas (histórico) y naves.
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { translationsFor } from "@/lib/i18n";
import { DONE_STATUSES, PENDING_STATUSES } from "@/lib/format";
import { getInSpace } from "@/lib/data/space";

const { launches: L, agencies: A, rocketConfigs: R, pads: P, locations: LOC, catalog: C } = schema;

function cached() {
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 1800, expire: 86400 });
}

type Img = { image_url?: string; thumbnail_url?: string; credit?: string | null } | null;
const img = (i: Img) => i?.thumbnail_url ?? i?.image_url ?? null;
const big = (i: Img) => i?.image_url ?? i?.thumbnail_url ?? null;

/** Duración ISO 8601 (P1DT2H3M4S) → segundos */
export function isoDur(d: string | null | undefined) {
  if (!d) return null;
  const m = d.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?/);
  if (!m) return null;
  const [, y, mo, dd, h, mi, s] = m.map((x) => Number(x ?? 0));
  return ((y * 365 + mo * 30 + dd) * 24 + h) * 3600 + mi * 60 + s;
}

/** Id válido para una columna int4 (evita errores SQL con NaN, decimales o fuera de rango). */
const validId = (id: number) => Number.isInteger(id) && id > 0 && id <= 2147483647;

async function catalogOf<T>(kind: string) {
  const rows = await db.select({ data: C.data }).from(C).where(eq(C.kind, kind));
  return rows.map((r) => r.data as T);
}

const launchCols = {
  id: L.id, slug: L.slug, name: L.name, statusAbbrev: L.statusAbbrev, statusName: L.statusName, net: L.net,
  netPrecision: L.netPrecision, windowStart: L.windowStart, windowEnd: L.windowEnd, missionName: L.missionName,
  missionType: L.missionType, orbitAbbrev: L.orbitAbbrev, orbitName: L.orbitName, imageUrl: L.imageUrl,
  thumbnailUrl: L.thumbnailUrl, countryCode: L.countryCode, webcastLive: L.webcastLive, providerId: L.providerId,
  providerName: A.name, providerAbbrev: A.abbrev, providerType: A.type, rocketName: R.name, rocketFullName: R.fullName,
  padId: L.padId, padName: P.name, locationId: L.locationId, locationName: LOC.name, locationTz: LOC.timezone,
  latitude: P.latitude, longitude: P.longitude,
};
const launchQuery = () =>
  db.select(launchCols).from(L).leftJoin(A, eq(L.providerId, A.id)).leftJoin(R, eq(L.rocketConfigId, R.id)).leftJoin(P, eq(L.padId, P.id)).leftJoin(LOC, eq(L.locationId, LOC.id));

// ───────────── Programas ─────────────

type RawProgram = {
  id: number; name: string; image?: Img; description?: string | null; wiki_url?: string | null; info_url?: string | null;
  start_date?: string | null; end_date?: string | null; type?: { name?: string } | null; agencies?: { id: number; name: string; abbrev?: string | null }[];
};
export type Program = {
  id: number; name: string; image: string | null; imageBig: string | null; description: string | null; descriptionEs: string | null;
  wikiUrl: string | null; infoUrl: string | null; start: string | null; end: string | null; type: string | null;
  agencies: { id: number; name: string; abbrev: string | null }[]; launches: number; upcoming: number; last: string | null; next: string | null; nextPrecision: string | null;
};

const PROGRAM_TYPE: Record<string, string> = {
  "Human Spaceflight": "Vuelo tripulado", "Robotic Exploration": "Exploración robótica", "Robotic": "Robótico", "Navigation": "Navegación",
  "Communications": "Comunicaciones", "Earth Science": "Ciencias de la Tierra", "Science": "Ciencia", "Lunar": "Lunar", "Constellation": "Constelación",
  "Navigation Constellation": "Constelación de navegación", "Communication Constellation": "Constelación de comunicaciones", "Technology": "Tecnología",
  "Exploration": "Exploración", "Earth Observation": "Observación de la Tierra",
};
export const programType = (t: string | null) => (t ? PROGRAM_TYPE[t] ?? t : null);

export async function listPrograms(): Promise<Program[]> {
  "use cache";
  cached();
  // Programas del catálogo + los que aparecen embebidos en lanzamientos (por si el catálogo aún no se ha descargado)
  const [cat, { rows: emb }, { rows: counts }] = await Promise.all([
    catalogOf<RawProgram>("programs"),
    db.execute<{ p: RawProgram }>(sql`SELECT DISTINCT ON ((p->>'id')::int) p FROM launches, jsonb_array_elements(COALESCE(raw->'program','[]'::jsonb)) p ORDER BY (p->>'id')::int, updated_at DESC`),
    db.execute<{ id: number; n: number; up: number; last: string | null; next: string | null; next_precision: string | null }>(sql`
      SELECT (p->>'id')::int id,
        count(*) FILTER (WHERE l.status_abbrev IN ('Success','Failure','Partial Failure'))::int n,
        count(*) FILTER (WHERE l.net > now() - interval '3 hours' AND l.status_abbrev IN ('Go','TBC','TBD','Hold','In Flight'))::int up,
        max(l.net) FILTER (WHERE l.status_abbrev IN ('Success','Failure','Partial Failure'))::text last,
        min(l.net) FILTER (WHERE l.net > now() - interval '3 hours' AND l.status_abbrev IN ('Go','TBC','TBD','Hold','In Flight'))::text next,
        (array_agg(l.net_precision ORDER BY l.net) FILTER (WHERE l.net > now() - interval '3 hours' AND l.status_abbrev IN ('Go','TBC','TBD','Hold','In Flight')))[1] next_precision
      FROM launches l, jsonb_array_elements(COALESCE(l.raw->'program','[]'::jsonb)) p GROUP BY 1`),
  ]);
  const byId = new Map<number, RawProgram>();
  for (const r of emb) byId.set(r.p.id, r.p);
  for (const p of cat) byId.set(p.id, p);
  const cnt = new Map(counts.map((c) => [c.id, c]));
  const list = [...byId.values()];
  const es = await translationsFor(list.map((p) => p.description));
  return list
    .map((p) => {
      const c = cnt.get(p.id);
      return {
        id: p.id, name: p.name, image: img(p.image ?? null), imageBig: big(p.image ?? null), description: p.description ?? null,
        descriptionEs: (p.description && es[p.description]) || null, wikiUrl: p.wiki_url ?? null, infoUrl: p.info_url ?? null,
        start: p.start_date ?? null, end: p.end_date ?? null, type: p.type?.name ?? null,
        agencies: (p.agencies ?? []).map((a) => ({ id: a.id, name: a.name, abbrev: a.abbrev ?? null })),
        launches: c?.n ?? 0, upcoming: c?.up ?? 0, last: c?.last ?? null, next: c?.next ?? null, nextPrecision: c?.next_precision ?? null,
      };
    })
    .sort((a, b) => b.upcoming - a.upcoming || (b.next ? 1 : 0) - (a.next ? 1 : 0) || b.launches - a.launches || a.name.localeCompare(b.name));
}

export async function getProgram(id: number) {
  "use cache";
  cached();
  if (!validId(id)) return null;
  const p = (await listPrograms()).find((x) => x.id === id);
  if (!p) return null;
  const has = sql`${L.raw}->'program' @> ${JSON.stringify([{ id }])}::jsonb`;
  const [upcoming, recent, { rows: years }, { rows: rockets }] = await Promise.all([
    launchQuery().where(and(has, sql`${L.net} > now() - interval '3 hours'`, sql`${L.statusAbbrev} IN ${sql.raw(`(${[...PENDING_STATUSES, "In Flight"].map((s) => `'${s}'`).join(",")})`)}`)).orderBy(asc(L.net)).limit(12),
    launchQuery().where(and(has, sql`${L.statusAbbrev} IN ${sql.raw(`(${DONE_STATUSES.map((s) => `'${s}'`).join(",")})`)}`)).orderBy(desc(L.net)).limit(16),
    db.execute<{ year: number; success: number; failure: number }>(sql`
      SELECT extract(year FROM net)::int AS year,
        count(*) FILTER (WHERE status_abbrev = 'Success')::int AS success,
        count(*) FILTER (WHERE status_abbrev IN ('Failure','Partial Failure'))::int AS failure
      FROM launches WHERE raw->'program' @> ${JSON.stringify([{ id }])}::jsonb AND status_abbrev IN ('Success','Failure','Partial Failure')
      GROUP BY 1 ORDER BY 1`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT r.id, COALESCE(r.full_name, r.name) name, count(*)::int n FROM launches l JOIN rocket_configs r ON r.id = l.rocket_config_id
      WHERE l.raw->'program' @> ${JSON.stringify([{ id }])}::jsonb GROUP BY r.id ORDER BY n DESC LIMIT 8`),
  ]);
  return { program: p, upcoming, recent, years, rockets };
}

// ───────────── Reutilización ─────────────

type RawLauncher = {
  id: number; serial_number: string | null; status?: { name?: string } | null; flight_proven?: boolean; image?: Img; details?: string | null;
  flights?: number | null; successful_landings?: number | null; attempted_landings?: number | null;
  first_launch_date?: string | null; last_launch_date?: string | null; fastest_turnaround?: string | null;
  launcher_config?: { id: number; name: string; full_name?: string | null; manufacturer?: { name?: string } | null } | null;
};
type RawLanding = {
  id: number; attempt?: boolean | null; success?: boolean | null; description?: string | null; downrange_distance?: number | null;
  landing_location?: { id: number; name: string; abbrev?: string | null; successful_landings?: number | null; attempted_landings?: number | null; failed_landings?: number | null; latitude?: number | null; longitude?: number | null; image?: Img; location?: { name?: string } | null; description?: string | null } | null;
  type?: { id: number; name: string; abbrev?: string | null } | null;
  firststage?: { reused?: boolean | null; launcher_flight_number?: number | null; launcher?: { id: number; serial_number?: string | null } | null } | null;
};
type RawStage = {
  type?: string; reused?: boolean | null; launcher_flight_number?: number | null; turn_around_time?: string | null;
  launcher?: { id: number; serial_number?: string | null; flights?: number | null; image?: Img; status?: { name?: string } | null } | null;
  landing?: { attempt?: boolean | null; success?: boolean | null; landing_location?: { name?: string; abbrev?: string | null } | null; type?: { name?: string; abbrev?: string | null } | null } | null;
};

const LANDING_TYPE: Record<string, string> = {
  ASDS: "Barcaza autónoma", RTLS: "Regreso al sitio", Ocean: "Océano", Helipad: "Helipuerto", Parachute: "Paracaídas", "Ocean Splashdown": "Amerizaje",
};
export const landingType = (abbrev?: string | null, name?: string | null) => (abbrev && LANDING_TYPE[abbrev]) || name || abbrev || "—";

const STATUS_ES: Record<string, string> = { active: "Activo", retired: "Retirado", expended: "Consumido", lost: "Perdido", destroyed: "Destruido", unknown: "Desconocido", "in-active": "Inactivo" };
export const launcherStatus = (s?: string | null) => (s ? STATUS_ES[s.toLowerCase()] ?? s : "—");

export async function getReuse() {
  "use cache";
  cached();
  const [launchers, landings, stages] = await Promise.all([
    catalogOf<RawLauncher>("launchers"),
    catalogOf<RawLanding>("landings"),
    db.execute<{ slug: string; name: string; net: string; precision: string | null; status: string | null; provider: string | null; s: RawStage }>(sql`
      SELECT l.slug, l.name, l.net::text, l.net_precision AS "precision", l.status_abbrev status, a.name provider, s
      FROM launches l LEFT JOIN agencies a ON a.id = l.provider_id, jsonb_array_elements(l.raw->'rocket'->'launcher_stage') s
      WHERE jsonb_typeof(l.raw->'rocket'->'launcher_stage') = 'array'
        AND (s->'landing') IS NOT NULL AND (s->'landing'->>'attempt')::boolean IS TRUE
        AND l.net > now() - interval '120 days' AND l.net < now() + interval '60 days'
      ORDER BY l.net DESC`),
  ]);
  const rows = stages.rows.map((r) => ({
    slug: r.slug, name: r.name, net: r.net, precision: r.precision, status: r.status, provider: r.provider,
    serial: r.s.launcher?.serial_number && !/^unknown/i.test(r.s.launcher.serial_number) ? r.s.launcher.serial_number : null, launcherId: r.s.launcher?.id ?? null, flight: r.s.launcher_flight_number ?? null,
    reused: !!r.s.reused, turnaround: isoDur(r.s.turn_around_time), success: r.s.landing?.success ?? null,
    where: [r.s.landing?.landing_location?.abbrev, r.s.landing?.landing_location?.name].find((x) => x && x !== "N/A") ?? null,
    whereName: r.s.landing?.landing_location?.name && r.s.landing.landing_location.name !== "N/A" ? r.s.landing.landing_location.name : null,
    type: landingType(r.s.landing?.type?.abbrev, r.s.landing?.type?.name),
  }));
  const now = Date.now();
  const upcoming = rows.filter((r) => Date.parse(r.net) > now - 3 * 3600_000 && r.success === null).reverse().slice(0, 10);
  const recent = rows.filter((r) => r.success !== null).slice(0, 14);

  // Propulsores
  const boosters = launchers
    .filter((b) => (b.flights ?? 0) > 0)
    .map((b) => ({
      id: b.id, serial: b.serial_number ?? `#${b.id}`, status: b.status?.name ?? null, flights: b.flights ?? 0,
      landings: b.successful_landings ?? 0, attempts: b.attempted_landings ?? 0, first: b.first_launch_date ?? null, last: b.last_launch_date ?? null,
      fastest: isoDur(b.fastest_turnaround), config: b.launcher_config?.full_name ?? b.launcher_config?.name ?? null, image: img(b.image ?? null),
    }));
  const leaders = [...boosters].sort((a, b) => b.flights - a.flights || b.landings - a.landings).slice(0, 15);
  const fastest = boosters.filter((b) => b.fastest && b.fastest > 3600).sort((a, b) => a.fastest! - b.fastest!).slice(0, 6);
  const fleetMap = new Map<string, { config: string; boosters: number; active: number; flights: number; landings: number; attempts: number; maxFlights: number }>();
  for (const b of boosters) {
    const k = b.config ?? "Otros";
    const f = fleetMap.get(k) ?? { config: k, boosters: 0, active: 0, flights: 0, landings: 0, attempts: 0, maxFlights: 0 };
    f.boosters++;
    if (b.status?.toLowerCase() === "active") f.active++;
    f.flights += b.flights;
    f.landings += b.landings;
    f.attempts += b.attempts;
    f.maxFlights = Math.max(f.maxFlights, b.flights);
    fleetMap.set(k, f);
  }
  const fleet = [...fleetMap.values()].sort((a, b) => b.flights - a.flights).slice(0, 10);

  // Zonas de aterrizaje (contadores oficiales de cada zona) y tipos
  const zoneMap = new Map<number, { id: number; name: string; abbrev: string | null; place: string | null; ok: number; attempts: number; fail: number; lat: number | null; lng: number | null }>();
  const typeMap = new Map<string, { type: string; n: number; ok: number }>();
  for (const l of landings) {
    const z = l.landing_location;
    if (z) zoneMap.set(z.id, { id: z.id, name: z.name, abbrev: z.abbrev ?? null, place: z.location?.name ?? null, ok: z.successful_landings ?? 0, attempts: z.attempted_landings ?? 0, fail: z.failed_landings ?? 0, lat: z.latitude ?? null, lng: z.longitude ?? null });
    if (l.attempt) {
      const t = landingType(l.type?.abbrev, l.type?.name);
      const e = typeMap.get(t) ?? { type: t, n: 0, ok: 0 };
      e.n++;
      if (l.success) e.ok++;
      typeMap.set(t, e);
    }
  }
  const zones = [...zoneMap.values()].filter((z) => z.attempts > 0).sort((a, b) => b.attempts - a.attempts).slice(0, 12);
  const types = [...typeMap.values()].sort((a, b) => b.n - a.n);
  const totals = {
    boosters: boosters.length,
    proven: boosters.filter((b) => b.flights > 1).length,
    active: boosters.filter((b) => b.status?.toLowerCase() === "active").length,
    landings: boosters.reduce((s, b) => s + b.landings, 0),
    attempts: boosters.reduce((s, b) => s + b.attempts, 0),
    maxFlights: leaders[0]?.flights ?? 0,
    maxSerial: leaders[0]?.serial ?? null,
    fastest: fastest[0] ?? null,
  };
  return { totals, upcoming, recent, leaders, fastest, fleet, zones, types, hasCatalog: launchers.length > 0 };
}

// ───────────── Astronautas ─────────────

type RawAstronaut = {
  id: number; name: string; status?: { name?: string } | null; agency?: { id: number; name: string; abbrev?: string | null } | null;
  image?: Img; type?: { name?: string } | null; in_space?: boolean; time_in_space?: string | null; eva_time?: string | null; age?: number | null;
  date_of_birth?: string | null; date_of_death?: string | null; nationality?: { name?: string; alpha_2_code?: string; alpha_3_code?: string }[];
  bio?: string | null; wiki?: string | null; flights_count?: number | null; landings_count?: number | null; spacewalks_count?: number | null;
  first_flight?: string | null; last_flight?: string | null;
};
export type Astronaut = {
  id: number; name: string; status: string | null; agency: string | null; agencyAbbrev: string | null; agencyId: number | null; image: string | null; imageBig: string | null;
  inSpace: boolean; timeInSpace: number; eva: number; age: number | null; born: string | null; died: string | null; country: string | null;
  countryName: string | null; flights: number; spacewalks: number; first: string | null; last: string | null; bio: string | null; wiki: string | null;
};
const ASTRO_STATUS: Record<string, string> = { Active: "Activo", Retired: "Retirado", Deceased: "Fallecido", "Lost In Training": "Fallecido en entrenamiento", "Lost In Flight": "Fallecido en vuelo", "In Training": "En entrenamiento", Dismissed: "Dado de baja", "Resigned during Training": "Renunció en entrenamiento" };
export const astroStatus = (s: string | null) => (s ? ASTRO_STATUS[s] ?? s : null);

function normAstro(a: RawAstronaut): Astronaut {
  const n = a.nationality?.[0];
  return {
    id: a.id, name: a.name, status: a.status?.name ?? null, agency: a.agency?.name ?? null, agencyAbbrev: a.agency?.abbrev ?? null, agencyId: a.agency?.id ?? null,
    image: img(a.image ?? null), imageBig: big(a.image ?? null), inSpace: !!a.in_space, timeInSpace: isoDur(a.time_in_space) ?? 0, eva: isoDur(a.eva_time) ?? 0,
    age: a.age ?? null, born: a.date_of_birth ?? null, died: a.date_of_death ?? null, country: n?.alpha_3_code ?? null, countryName: n?.name ?? null,
    flights: a.flights_count ?? 0, spacewalks: a.spacewalks_count ?? 0, first: a.first_flight ?? null, last: a.last_flight ?? null, bio: a.bio ?? null, wiki: a.wiki ?? null,
  };
}

/** Lista ligera (sin biografía) para el índice; los filtros se aplican en el cliente al instante. */
export async function listAstronauts() {
  "use cache";
  cached();
  // Sin biografías (pesan y el índice no las usa)
  const rows = await db.select({ data: sql<RawAstronaut>`${C.data} - 'bio'` }).from(C).where(eq(C.kind, "astronauts"));
  const all = rows.map((r) => r.data).filter((a) => a.type?.name !== "Non-Human").map(normAstro).filter((a) => a.flights > 0 || a.inSpace);
  return all.map(({ bio: _b, wiki: _w, imageBig: _i, ...rest }) => (void _b, void _w, void _i, rest));
}

export async function getAstronaut(id: number) {
  "use cache";
  cached();
  if (!validId(id)) return null;
  const [row] = await db.select({ data: C.data }).from(C).where(and(eq(C.kind, "astronauts"), eq(C.id, id))).limit(1);
  let a: Astronaut;
  if (row) a = normAstro(row.data as RawAstronaut);
  else {
    // Aún sin catálogo: quienes están ahora en el espacio vienen en la instantánea de "En el espacio"
    const x = (await getInSpace())?.astronauts.find((p) => p.id === id);
    if (!x) return null;
    a = {
      id: x.id, name: x.name, status: x.status, agency: x.agency, agencyAbbrev: x.agencyAbbrev, agencyId: x.agencyId, image: x.imageUrl, imageBig: x.imageUrl,
      inSpace: true, timeInSpace: isoDur(x.timeInSpace) ?? 0, eva: isoDur(x.evaTime) ?? 0, age: x.age, born: null, died: null, country: x.nationality[0] ?? null,
      countryName: null, flights: x.flights ?? 0, spacewalks: x.spacewalks ?? 0, first: x.firstFlight, last: x.lastFlight, bio: x.bio, wiki: x.wiki,
    };
  }
  // Contención (usa el índice GIN launches_spacecraft_stage_gin); spacecraft_stage llega como lista o como objeto
  const crew = JSON.stringify({ launch_crew: [{ astronaut: { id } }] });
  const stage = sql`(${L.raw}->'rocket'->'spacecraft_stage')`;
  const [flights, es] = await Promise.all([
    launchQuery().where(sql`(${stage} @> ${`[${crew}]`}::jsonb OR ${stage} @> ${crew}::jsonb)`).orderBy(desc(L.net)).limit(20),
    translationsFor([a.bio]),
  ]);
  return { astronaut: a, bioEs: (a.bio && es[a.bio]) || null, flights };
}

// ───────────── Naves ─────────────

type RawSpacecraft = {
  id: number; name: string; serial_number?: string | null; image?: Img; in_space?: boolean; time_in_space?: string | null; time_docked?: string | null;
  flights_count?: number | null; mission_ends_count?: number | null; status?: { name?: string } | null; description?: string | null;
  spacecraft_config?: { id: number; name: string; type?: { name?: string } | null; agency?: { id: number; name: string; abbrev?: string | null } | null; image?: Img; in_use?: boolean; capability?: string | null; human_rated?: boolean | null; crew_capacity?: number | null } | null;
};
const CRAFT_TYPE: Record<string, string> = { Capsule: "Cápsula", Cargo: "Carga", Spaceplane: "Avión espacial", "Unmanned Spacecraft": "Nave robótica", Rover: "Rover", Lander: "Módulo de aterrizaje", Probe: "Sonda" };
export const craftType = (t?: string | null) => (t ? CRAFT_TYPE[t] ?? t : null);
const CRAFT_STATUS: Record<string, string> = { Active: "Activa", Retired: "Retirada", "Single Use": "Un solo uso", Destroyed: "Destruida", Unknown: "Desconocido", "In Development": "En desarrollo", Decommissioned: "Fuera de servicio", Expended: "Consumida" };
export const craftStatus = (s?: string | null) => (s ? CRAFT_STATUS[s] ?? s : null);

export async function getSpacecraft() {
  "use cache";
  cached();
  const raw = await catalogOf<RawSpacecraft>("spacecraft");
  const items = raw.map((s) => ({
    id: s.id, name: s.name, serial: s.serial_number ?? null, image: img(s.image ?? null) ?? img(s.spacecraft_config?.image ?? null), inSpace: !!s.in_space,
    timeInSpace: isoDur(s.time_in_space) ?? 0, docked: isoDur(s.time_docked) ?? 0, flights: s.flights_count ?? 0, status: s.status?.name ?? null,
    configId: s.spacecraft_config?.id ?? 0, config: s.spacecraft_config?.name ?? "Otra", type: s.spacecraft_config?.type?.name ?? null,
    agency: s.spacecraft_config?.agency?.abbrev ?? s.spacecraft_config?.agency?.name ?? null, agencyId: s.spacecraft_config?.agency?.id ?? null,
    humanRated: !!s.spacecraft_config?.human_rated, crew: s.spacecraft_config?.crew_capacity ?? null,
  }));
  const groups = new Map<number, { id: number; name: string; type: string | null; agency: string | null; agencyId: number | null; image: string | null; humanRated: boolean; crew: number | null; units: number; inSpace: number; flights: number; time: number; maxFlights: number }>();
  for (const s of items) {
    const g = groups.get(s.configId) ?? { id: s.configId, name: s.config, type: s.type, agency: s.agency, agencyId: s.agencyId, image: null as string | null, humanRated: s.humanRated, crew: s.crew, units: 0, inSpace: 0, flights: 0, time: 0, maxFlights: 0 };
    g.units++;
    if (s.inSpace) g.inSpace++;
    g.flights += s.flights;
    g.time += s.timeInSpace;
    g.maxFlights = Math.max(g.maxFlights, s.flights);
    g.image ??= s.image;
    groups.set(s.configId, g);
  }
  return { items, groups: [...groups.values()].sort((a, b) => b.inSpace - a.inSpace || b.flights - a.flights) };
}

export async function catalogStatus() {
  "use cache";
  cached();
  const { rows } = await db.execute<{ kind: string; n: number; at: string }>(sql`SELECT kind, count(*)::int n, max(updated_at)::text at FROM catalog GROUP BY kind`);
  return Object.fromEntries(rows.map((r) => [r.kind, { n: r.n, at: r.at }])) as Record<string, { n: number; at: string } | undefined>;
}
