// Organizaciones, bases y vehículos. Conteos calculados con nuestra BD + totales oficiales de LL2.
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DONE_STATUSES, PENDING_STATUSES } from "@/lib/format";

const { launches: L, agencies: A, rocketConfigs: R, pads: P, locations: LOC } = schema;

function cached() {
  cacheTag("ll2");
  cacheLife({ stale: 120, revalidate: 900, expire: 7200 });
}

export { AGENCY_TYPES, typeLabel } from "./entities-labels";

const launchCols = {
  id: L.id, slug: L.slug, name: L.name, statusAbbrev: L.statusAbbrev, statusName: L.statusName, net: L.net,
  netPrecision: L.netPrecision, windowStart: L.windowStart, windowEnd: L.windowEnd, missionName: L.missionName,
  missionType: L.missionType, orbitAbbrev: L.orbitAbbrev, orbitName: L.orbitName, imageUrl: L.imageUrl,
  thumbnailUrl: L.thumbnailUrl, countryCode: L.countryCode, webcastLive: L.webcastLive, providerId: L.providerId,
  providerName: A.name, providerAbbrev: A.abbrev, providerType: A.type, rocketName: R.name, rocketFullName: R.fullName,
  padId: L.padId, padName: P.name, locationId: L.locationId, locationName: LOC.name, locationTz: LOC.timezone,
  latitude: P.latitude, longitude: P.longitude,
};

function launchList(where: SQL | undefined, dir: "asc" | "desc", limit: number) {
  return db
    .select(launchCols)
    .from(L)
    .leftJoin(A, eq(L.providerId, A.id))
    .leftJoin(R, eq(L.rocketConfigId, R.id))
    .leftJoin(P, eq(L.padId, P.id))
    .leftJoin(LOC, eq(L.locationId, LOC.id))
    .where(where)
    .orderBy(dir === "asc" ? asc(L.net) : desc(L.net))
    .limit(limit);
}
const upcomingOf = (col: SQL | undefined) => and(col, sql`${L.net} > now() - interval '3 hours'`, inArray(L.statusAbbrev, [...PENDING_STATUSES, "In Flight"]));
const pastOf = (col: SQL | undefined) => and(col, inArray(L.statusAbbrev, DONE_STATUSES));

async function yearly(col: SQL) {
  const { rows } = await db.execute<{ year: number; success: number; failure: number }>(sql`
    SELECT extract(year FROM net)::int AS year,
      count(*) FILTER (WHERE status_abbrev = 'Success')::int AS success,
      count(*) FILTER (WHERE status_abbrev IN ('Failure','Partial Failure'))::int AS failure
    FROM launches WHERE ${col} AND status_abbrev IN ('Success','Failure','Partial Failure')
    GROUP BY 1 ORDER BY 1`);
  return rows;
}

// ───────────── Organizaciones ─────────────

export type OrgSort = "az" | "activas" | "menos";

export async function listOrganizations(opts: { q?: string; tipo?: string; pais?: string; orden?: OrgSort }) {
  "use cache";
  cached();
  const like = opts.q ? `%${opts.q.replace(/[%_]/g, "")}%` : null;
  const order =
    opts.orden === "activas" ? sql`recent DESC, a.name` : opts.orden === "menos" ? sql`COALESCE(a.total_launch_count, known) ASC, a.name` : sql`a.name`;
  const { rows } = await db.execute<{
    id: number; name: string; abbrev: string | null; type: string | null; country_codes: string[] | null; logo_url: string | null;
    total: number | null; known: number; upcoming: number; recent: number; founding_year: number | null;
  }>(sql`
    WITH act AS (
      SELECT provider_id,
        count(*)::int AS known,
        count(*) FILTER (WHERE net > now() AND status_abbrev IN ('Go','TBC','TBD','Hold'))::int AS upcoming,
        count(*) FILTER (WHERE net BETWEEN now() - interval '365 days' AND now())::int AS recent
      FROM launches WHERE provider_id IS NOT NULL GROUP BY provider_id)
    SELECT a.id, a.name, a.abbrev, a.type, a.country_codes, a.logo_url, a.total_launch_count AS total, a.founding_year,
           COALESCE(act.known, 0) AS known, COALESCE(act.upcoming, 0) AS upcoming, COALESCE(act.recent, 0) AS recent
    FROM agencies a LEFT JOIN act ON act.provider_id = a.id
    WHERE (act.known > 0 OR a.total_launch_count > 0)
      ${like ? sql`AND (a.name ILIKE ${like} OR a.abbrev ILIKE ${like})` : sql``}
      ${opts.tipo ? sql`AND a.type = ${opts.tipo}` : sql``}
      ${opts.pais ? sql`AND ${opts.pais} = ANY(a.country_codes)` : sql``}
    ORDER BY ${order}`);
  return rows;
}

export async function getOrganization(id: number) {
  "use cache";
  cached();
  const [org] = await db.select().from(A).where(eq(A.id, id)).limit(1);
  if (!org) return null;
  const col = eq(L.providerId, id);
  const [upcoming, recent, rockets, pads, years] = await Promise.all([
    launchList(upcomingOf(col), "asc", 8),
    launchList(pastOf(col), "desc", 10),
    db.execute<{ id: number; name: string; n: number; success: number }>(sql`
      SELECT r.id, COALESCE(r.full_name, r.name) AS name, count(*)::int n, count(*) FILTER (WHERE l.status_abbrev = 'Success')::int success
      FROM launches l JOIN rocket_configs r ON r.id = l.rocket_config_id WHERE l.provider_id = ${id}
      GROUP BY r.id ORDER BY n DESC LIMIT 12`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT loc.id, loc.name, count(*)::int n FROM launches l JOIN locations loc ON loc.id = l.location_id
      WHERE l.provider_id = ${id} GROUP BY loc.id, loc.name ORDER BY n DESC LIMIT 8`),
    yearly(sql`provider_id = ${id}`),
  ]);
  const { raw, ...rest } = org;
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    org: rest,
    administrator: (r.administrator as string) || null,
    launchers: (r.launchers as string) || null,
    spacecraft: (r.spacecraft as string) || null,
    upcoming, recent, rockets: rockets.rows, pads: pads.rows, years,
  };
}

// ───────────── Bases ─────────────

export async function listLocations() {
  "use cache";
  cached();
  const { rows } = await db.execute<{
    id: number; name: string; country_code: string | null; lat: number | null; lng: number | null; total: number;
    pads: number; upcoming: number; recent: number; image_url: string | null;
  }>(sql`
    SELECT loc.id, loc.name, loc.country_code, loc.latitude AS lat, loc.longitude AS lng, loc.image_url,
      GREATEST(COALESCE(loc.total_launch_count, 0), (SELECT count(*) FROM launches l WHERE l.location_id = loc.id))::int AS total,
      (SELECT count(*)::int FROM pads p WHERE p.location_id = loc.id) AS pads,
      (SELECT count(*)::int FROM launches l WHERE l.location_id = loc.id AND l.net > now() AND l.status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming,
      (SELECT count(*)::int FROM launches l WHERE l.location_id = loc.id AND l.net BETWEEN now() - interval '365 days' AND now()) AS recent
    FROM locations loc
    WHERE COALESCE(loc.total_launch_count, 0) > 0 OR EXISTS (SELECT 1 FROM launches l WHERE l.location_id = loc.id)
    ORDER BY upcoming DESC, recent DESC, total DESC`);
  return rows;
}

export async function getLocation(id: number) {
  "use cache";
  cached();
  const [loc] = await db.select().from(LOC).where(eq(LOC.id, id)).limit(1);
  if (!loc) return null;
  const col = eq(L.locationId, id);
  const [pads, upcoming, recent, operators, years] = await Promise.all([
    db.execute<{ id: number; name: string; lat: number | null; lng: number | null; active: boolean | null; total: number | null; upcoming: number }>(sql`
      SELECT p.id, p.name, p.latitude AS lat, p.longitude AS lng, p.active,
        GREATEST(COALESCE(p.total_launch_count, 0), (SELECT count(*) FROM launches l WHERE l.pad_id = p.id))::int AS total,
        (SELECT count(*)::int FROM launches l WHERE l.pad_id = p.id AND l.net > now() AND l.status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming
      FROM pads p WHERE p.location_id = ${id} ORDER BY upcoming DESC, total DESC`),
    launchList(upcomingOf(col), "asc", 8),
    launchList(pastOf(col), "desc", 10),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT a.id, a.name, count(*)::int n FROM launches l JOIN agencies a ON a.id = l.provider_id
      WHERE l.location_id = ${id} GROUP BY a.id, a.name ORDER BY n DESC LIMIT 10`),
    yearly(sql`location_id = ${id}`),
  ]);
  const { raw: _r, ...rest } = loc;
  void _r;
  return { loc: rest, pads: pads.rows, upcoming, recent, operators: operators.rows, years };
}

// ───────────── Vehículos ─────────────

export async function listRockets(opts: { q?: string; estado?: "activos" | "retirados" }) {
  "use cache";
  cached();
  const like = opts.q ? `%${opts.q.replace(/[%_]/g, "")}%` : null;
  const { rows } = await db.execute<{
    id: number; name: string; full_name: string | null; family: string | null; active: boolean | null; reusable: boolean | null;
    image_url: string | null; total: number | null; success: number | null; manufacturer: string | null; manufacturer_id: number | null;
    upcoming: number; country_codes: string[] | null;
  }>(sql`
    SELECT r.id, r.name, r.full_name, r.family, r.active, r.reusable, r.image_url, r.total_launch_count AS total,
      r.successful_launches AS success, a.name AS manufacturer, a.id AS manufacturer_id, a.country_codes,
      (SELECT count(*)::int FROM launches l WHERE l.rocket_config_id = r.id AND l.net > now() AND l.status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming
    FROM rocket_configs r LEFT JOIN agencies a ON a.id = r.manufacturer_id
    WHERE COALESCE(r.total_launch_count, 0) > 0 OR EXISTS (SELECT 1 FROM launches l WHERE l.rocket_config_id = r.id)
      ${like ? sql`AND (r.name ILIKE ${like} OR r.full_name ILIKE ${like} OR r.family ILIKE ${like})` : sql``}
      ${opts.estado === "activos" ? sql`AND r.active` : opts.estado === "retirados" ? sql`AND NOT r.active` : sql``}
    ORDER BY upcoming DESC, total DESC NULLS LAST`);
  return rows;
}

export async function getRocket(id: number) {
  "use cache";
  cached();
  const [row] = await db
    .select({ r: R, maker: { id: A.id, name: A.name, countryCodes: A.countryCodes } })
    .from(R)
    .leftJoin(A, eq(R.manufacturerId, A.id))
    .where(eq(R.id, id))
    .limit(1);
  if (!row) return null;
  const col = eq(L.rocketConfigId, id);
  const [upcoming, recent, years] = await Promise.all([
    launchList(upcomingOf(col), "asc", 8),
    launchList(pastOf(col), "desc", 10),
    yearly(sql`rocket_config_id = ${id}`),
  ]);
  const { raw, ...rest } = row.r;
  const x = (raw ?? {}) as Record<string, unknown>;
  return {
    rocket: rest,
    maker: row.maker,
    specs: {
      stages: x.max_stage ?? null,
      launchMass: (x.launch_mass as number) ?? null,
      thrust: (x.to_thrust as number) ?? null,
      ssoCapacity: (x.sso_capacity as number) ?? null,
      apogee: (x.apogee as number) ?? null,
      landings: (x.successful_landings as number) ?? null,
    },
    upcoming, recent, years,
  };
}
