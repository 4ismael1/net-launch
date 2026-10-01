import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DONE_STATUSES, PENDING_STATUSES } from "@/lib/format";

const { launches: L, agencies: A, rocketConfigs: R, pads: P, locations: LOC } = schema;

export type Filters = {
  q?: string;
  vista?: "proximos" | "pasados" | "todos";
  estado?: string; // abbrev LL2 o "exitosos"/"fallidos"
  op?: number;
  pais?: string;
  cohete?: number;
  base?: number;
  dias?: number; // próximos N días
  desde?: string; // YYYY-MM-DD
  hasta?: string;
  orden?: "asc" | "desc";
  page?: number;
};

export const PAGE_SIZE = 24;

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  // Solo enteros en rango (ids int4, días, página): "1.5", "1e9" o "-3" se ignoran en vez de romper la consulta
  const num = (k: string, max = 2147483647) => {
    const v = Number(g(k));
    return g(k) && Number.isInteger(v) && v > 0 && v <= max ? v : undefined;
  };
  const vista = g("vista");
  return {
    q: g("q")?.slice(0, 80),
    vista: vista === "pasados" || vista === "todos" ? vista : "proximos",
    estado: g("estado"),
    op: num("op"),
    pais: g("pais")?.slice(0, 3),
    cohete: num("cohete"),
    base: num("base"),
    dias: num("dias", 3650),
    desde: g("desde"),
    hasta: g("hasta"),
    orden: g("orden") === "asc" || g("orden") === "desc" ? (g("orden") as "asc" | "desc") : undefined,
    page: num("page", 10_000) ?? 1,
  };
}

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export async function searchLaunches(f: Filters) {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const w: (SQL | undefined)[] = [];
  if (f.vista === "proximos") w.push(gte(L.net, sql`now() - interval '3 hours'`), inArray(L.statusAbbrev, [...PENDING_STATUSES, "In Flight"]));
  if (f.vista === "pasados") w.push(inArray(L.statusAbbrev, DONE_STATUSES));
  if (f.estado === "exitosos") w.push(eq(L.statusAbbrev, "Success"));
  else if (f.estado === "fallidos") w.push(inArray(L.statusAbbrev, ["Failure", "Partial Failure"]));
  else if (f.estado) w.push(eq(L.statusAbbrev, f.estado));
  if (f.op) w.push(eq(L.providerId, f.op));
  if (f.pais) w.push(eq(L.countryCode, f.pais));
  if (f.cohete) w.push(eq(L.rocketConfigId, f.cohete));
  if (f.base) w.push(eq(L.locationId, f.base));
  if (f.dias) w.push(lte(L.net, sql`now() + make_interval(days => ${f.dias})`));
  if (isDate(f.desde)) w.push(gte(L.net, new Date(`${f.desde}T00:00:00Z`)));
  if (isDate(f.hasta)) w.push(lte(L.net, new Date(`${f.hasta}T23:59:59Z`)));
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    w.push(or(ilike(L.name, like), ilike(L.missionName, like), ilike(R.name, like), ilike(A.name, like), ilike(A.abbrev, like), ilike(LOC.name, like), ilike(P.name, like)));
  }
  const where = and(...w);
  const dir = f.orden ?? (f.vista === "proximos" ? "asc" : "desc");
  const page = f.page ?? 1;

  const base = () =>
    db
      .select({
        id: L.id, slug: L.slug, name: L.name, statusAbbrev: L.statusAbbrev, net: L.net, netPrecision: L.netPrecision,
        missionName: L.missionName, orbitAbbrev: L.orbitAbbrev, imageUrl: L.imageUrl, thumbnailUrl: L.thumbnailUrl,
        countryCode: L.countryCode, webcastLive: L.webcastLive,
        providerName: A.name, providerAbbrev: A.abbrev, rocketName: R.name, padName: P.name, locationName: LOC.name,
      })
      .from(L)
      .leftJoin(A, eq(L.providerId, A.id))
      .leftJoin(R, eq(L.rocketConfigId, R.id))
      .leftJoin(P, eq(L.padId, P.id))
      .leftJoin(LOC, eq(L.locationId, LOC.id));

  const [rows, [{ total }]] = await Promise.all([
    base().where(where).orderBy(dir === "asc" ? asc(L.net) : desc(L.net)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(L)
      .leftJoin(A, eq(L.providerId, A.id))
      .leftJoin(R, eq(L.rocketConfigId, R.id))
      .leftJoin(P, eq(L.padId, P.id))
      .leftJoin(LOC, eq(L.locationId, LOC.id))
      .where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type ExploreRow = Awaited<ReturnType<typeof searchLaunches>>["rows"][number];

/** Opciones de los filtros (solo valores presentes en los datos). */
export async function getFilterOptions() {
  "use cache";
  cacheTag("ll2");
  cacheLife("hours");
  const [ops, rockets, locs, countries] = await Promise.all([
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT a.id, a.name, count(*)::int n FROM launches l JOIN agencies a ON a.id = l.provider_id GROUP BY a.id, a.name ORDER BY a.name`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT r.id, COALESCE(r.full_name, r.name) AS name, count(*)::int n FROM launches l JOIN rocket_configs r ON r.id = l.rocket_config_id GROUP BY r.id ORDER BY 2`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT loc.id, loc.name, count(*)::int n FROM launches l JOIN locations loc ON loc.id = l.location_id GROUP BY loc.id, loc.name ORDER BY loc.name`),
    db.execute<{ code: string; n: number }>(sql`
      SELECT country_code AS code, count(*)::int n FROM launches WHERE country_code IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
  ]);
  return { operators: ops.rows, rockets: rockets.rows, locations: locs.rows, countries: countries.rows };
}

/** Búsqueda global agrupada para la paleta Ctrl+K. */
export async function globalSearch(q: string) {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 600, expire: 3600 });
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const [launches, orgs, rockets, bases] = await Promise.all([
    db.execute<{ slug: string; name: string; net: string | null; status: string | null }>(sql`
      SELECT l.slug, l.name, l.net, l.status_abbrev AS status FROM launches l
      LEFT JOIN rocket_configs r ON r.id = l.rocket_config_id
      WHERE l.name ILIKE ${like} OR l.mission_name ILIKE ${like} OR r.name ILIKE ${like}
      ORDER BY (l.net > now()) DESC, abs(extract(epoch FROM (l.net - now()))) ASC LIMIT 6`),
    db.execute<{ id: number; name: string; abbrev: string | null }>(sql`
      SELECT id, name, abbrev FROM agencies WHERE name ILIKE ${like} OR abbrev ILIKE ${like}
      ORDER BY total_launch_count DESC NULLS LAST LIMIT 5`),
    db.execute<{ id: number; name: string }>(sql`
      SELECT id, COALESCE(full_name, name) AS name FROM rocket_configs WHERE name ILIKE ${like} OR full_name ILIKE ${like}
      ORDER BY total_launch_count DESC NULLS LAST LIMIT 5`),
    db.execute<{ id: number; name: string; country: string | null }>(sql`
      SELECT id, name, country_code AS country FROM locations WHERE name ILIKE ${like}
      ORDER BY total_launch_count DESC NULLS LAST LIMIT 5`),
  ]);
  return { launches: launches.rows, orgs: orgs.rows, rockets: rockets.rows, bases: bases.rows };
}
