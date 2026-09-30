// Capa de datos: el frontend SOLO lee de nuestra BD (nunca de LL2).
// Todo se cachea y se invalida con la etiqueta "ll2" tras cada sincronización.
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DONE_STATUSES, PENDING_STATUSES } from "@/lib/format";

const { launches: L, agencies: A, rocketConfigs: R, pads: P, locations: LOC } = schema;

function cached() {
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
}

const card = {
  id: L.id,
  slug: L.slug,
  name: L.name,
  statusAbbrev: L.statusAbbrev,
  statusName: L.statusName,
  net: L.net,
  netPrecision: L.netPrecision,
  windowStart: L.windowStart,
  windowEnd: L.windowEnd,
  missionName: L.missionName,
  missionType: L.missionType,
  orbitAbbrev: L.orbitAbbrev,
  orbitName: L.orbitName,
  imageUrl: L.imageUrl,
  thumbnailUrl: L.thumbnailUrl,
  countryCode: L.countryCode,
  webcastLive: L.webcastLive,
  providerId: L.providerId,
  providerName: A.name,
  providerAbbrev: A.abbrev,
  providerType: A.type,
  rocketName: R.name,
  rocketFullName: R.fullName,
  padId: L.padId,
  padName: P.name,
  locationId: L.locationId,
  locationName: LOC.name,
  locationTz: LOC.timezone,
  latitude: P.latitude,
  longitude: P.longitude,
};

export type LaunchCard = Awaited<ReturnType<typeof getUpcoming>>[number];

function baseQuery() {
  return db
    .select(card)
    .from(L)
    .leftJoin(A, eq(L.providerId, A.id))
    .leftJoin(R, eq(L.rocketConfigId, R.id))
    .leftJoin(P, eq(L.padId, P.id))
    .leftJoin(LOC, eq(L.locationId, LOC.id));
}

const upcomingWhere = () =>
  and(
    gte(L.net, sql`now() - interval '3 hours'`),
    inArray(L.statusAbbrev, [...PENDING_STATUSES, "In Flight"]),
  );

/** Próximo lanzamiento: el más cercano con hora precisa; si no hay, el más cercano previsto. */
export async function getNextLaunch() {
  "use cache";
  cached();
  const [precise] = await baseQuery()
    .where(and(upcomingWhere(), inArray(L.netPrecision, ["SEC", "MIN", "HR"])))
    .orderBy(asc(L.net))
    .limit(1);
  if (precise) return precise;
  const [any] = await baseQuery().where(upcomingWhere()).orderBy(asc(L.net)).limit(1);
  return any ?? null;
}

export async function getUpcoming(limit = 8) {
  "use cache";
  cached();
  return baseQuery().where(upcomingWhere()).orderBy(asc(L.net)).limit(limit);
}

export async function getRecent(limit = 6) {
  "use cache";
  cached();
  return baseQuery()
    .where(and(inArray(L.statusAbbrev, DONE_STATUSES), sql`${L.net} <= now()`))
    .orderBy(desc(L.net))
    .limit(limit);
}

export async function getKpis() {
  "use cache";
  cached();
  const { rows } = await db.execute<{
    upcoming: number;
    month: number;
    year_done: number;
    year_success: number;
    countries: number;
    operators: number;
    total: number;
    year: number;
  }>(sql`
    SELECT
      extract(year from now())::int AS year,
      count(*) FILTER (WHERE net >= now() AND status_abbrev IN ('Go','TBC','TBD','Hold'))::int AS upcoming,
      count(*) FILTER (WHERE date_trunc('month', net) = date_trunc('month', now()))::int AS month,
      count(*) FILTER (WHERE date_trunc('year', net) = date_trunc('year', now()) AND status_abbrev IN ('Success','Failure','Partial Failure'))::int AS year_done,
      count(*) FILTER (WHERE date_trunc('year', net) = date_trunc('year', now()) AND status_abbrev = 'Success')::int AS year_success,
      count(DISTINCT country_code) FILTER (WHERE net BETWEEN now() - interval '365 days' AND now() + interval '90 days')::int AS countries,
      count(DISTINCT provider_id) FILTER (WHERE net BETWEEN now() - interval '365 days' AND now() + interval '90 days')::int AS operators,
      count(*)::int AS total
    FROM launches`);
  return rows[0];
}

/**
 * "Menos conocidos": operadores con actividad reciente o próxima que NO están entre los 5 más activos
 * del último año. Se elige uno distinto cada día (determinista, sin azar).
 */
export async function getSpotlight() {
  "use cache";
  cached();
  const { rows } = await db.execute<{
    id: number;
    name: string;
    abbrev: string | null;
    type: string | null;
    country_codes: string[] | null;
    logo_url: string | null;
    recent: number;
    upcoming: number;
    total: number | null;
  }>(sql`
    WITH activity AS (
      SELECT provider_id,
        count(*) FILTER (WHERE net BETWEEN now() - interval '730 days' AND now()) AS recent,
        count(*) FILTER (WHERE net > now() AND status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming,
        count(*) FILTER (WHERE net BETWEEN now() - interval '365 days' AND now()) AS last_year
      FROM launches WHERE provider_id IS NOT NULL GROUP BY provider_id
    ), top AS (SELECT provider_id FROM activity ORDER BY last_year DESC LIMIT 5)
    SELECT a.id, a.name, a.abbrev, a.type, a.country_codes, a.logo_url,
           act.recent::int, act.upcoming::int, a.total_launch_count AS total
    FROM activity act JOIN agencies a ON a.id = act.provider_id
    WHERE act.provider_id NOT IN (SELECT provider_id FROM top) AND (act.recent > 0 OR act.upcoming > 0)
    ORDER BY a.id`);
  if (!rows.length) return null;
  const day = Math.floor(Date.now() / 864e5);
  return rows[day % rows.length];
}

/** Bases con coordenadas y su actividad, para el mapa/minimapa. */
export async function getPadPoints() {
  "use cache";
  cached();
  const { rows } = await db.execute<{
    id: number;
    name: string;
    lat: number;
    lng: number;
    location_name: string | null;
    country_code: string | null;
    total: number | null;
    upcoming: number;
  }>(sql`
    SELECT p.id, p.name, p.latitude AS lat, p.longitude AS lng, loc.name AS location_name, p.country_code,
           p.total_launch_count AS total,
           (SELECT count(*)::int FROM launches l WHERE l.pad_id = p.id AND l.net > now()
              AND l.status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming
    FROM pads p LEFT JOIN locations loc ON loc.id = p.location_id
    WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND (p.total_launch_count > 0 OR EXISTS (SELECT 1 FROM launches l WHERE l.pad_id = p.id))`);
  return rows;
}

export async function getLastSync() {
  "use cache";
  cached();
  const [row] = await db
    .select({ at: schema.syncRuns.finishedAt })
    .from(schema.syncRuns)
    .where(and(eq(schema.syncRuns.ok, true), sql`${schema.syncRuns.requests} > 0`))
    .orderBy(desc(schema.syncRuns.finishedAt))
    .limit(1);
  return row?.at ?? null;
}

