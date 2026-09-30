// Estadísticas agregadas desde nuestra BD (datos reales sincronizados de LL2).
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type Period = "12m" | "5a" | "todo";
const since = (p: Period) =>
  p === "12m" ? sql`net >= now() - interval '365 days'` : p === "5a" ? sql`net >= now() - interval '5 years'` : sql`TRUE`;
const DONE = sql`status_abbrev IN ('Success','Failure','Partial Failure') AND net <= now()`;

export async function getStats(period: Period) {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  const w = since(period);

  const [years, countries, operators, rockets, bases, monthly, coverage, calendar] = await Promise.all([
    db.execute<{ year: number; success: number; failure: number }>(sql`
      SELECT extract(year FROM net)::int AS year,
        count(*) FILTER (WHERE status_abbrev = 'Success')::int AS success,
        count(*) FILTER (WHERE status_abbrev IN ('Failure','Partial Failure'))::int AS failure
      FROM launches WHERE ${DONE} GROUP BY 1 ORDER BY 1`),
    db.execute<{ code: string; n: number }>(sql`
      SELECT country_code AS code, count(*)::int n FROM launches
      WHERE ${DONE} AND ${w} AND country_code IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT a.id, a.name, count(*)::int n FROM launches l JOIN agencies a ON a.id = l.provider_id
      WHERE ${DONE} AND ${w} GROUP BY a.id, a.name ORDER BY n DESC`),
    db.execute<{ id: number; name: string; n: number; success: number }>(sql`
      SELECT r.id, COALESCE(r.full_name, r.name) AS name, count(*)::int n, count(*) FILTER (WHERE l.status_abbrev = 'Success')::int success
      FROM launches l JOIN rocket_configs r ON r.id = l.rocket_config_id
      WHERE ${DONE} AND ${w} GROUP BY r.id ORDER BY n DESC LIMIT 12`),
    db.execute<{ id: number; name: string; n: number }>(sql`
      SELECT loc.id, loc.name, count(*)::int n FROM launches l JOIN locations loc ON loc.id = l.location_id
      WHERE ${DONE} AND ${w} GROUP BY loc.id, loc.name ORDER BY n DESC LIMIT 12`),
    db.execute<{ month: string; done: number; planned: number }>(sql`
      SELECT to_char(m, 'YYYY-MM') AS month,
        (SELECT count(*)::int FROM launches WHERE date_trunc('month', net) = m AND status_abbrev IN ('Success','Failure','Partial Failure')) AS done,
        (SELECT count(*)::int FROM launches WHERE date_trunc('month', net) = m AND status_abbrev IN ('Go','TBC') AND net > now()) AS planned
      FROM generate_series(date_trunc('month', now()) - interval '23 months', date_trunc('month', now()) + interval '3 months', interval '1 month') m
      ORDER BY 1`),
    db.execute<{ synced: number; oldest: string | null }>(sql`
      SELECT count(*)::int AS synced, min(net)::text AS oldest FROM launches WHERE ${DONE}`),
    db.execute<{ day: string; n: number }>(sql`
      SELECT to_char(net, 'YYYY-MM-DD') AS day, count(*)::int n FROM launches
      WHERE ${DONE} AND net >= date_trunc('year', now()) GROUP BY 1`),
  ]);

  // Concentración (Herfindahl-Hirschman): Σ cuota² × 10 000. >2500 = muy concentrado.
  const conc = (rows: { n: number }[]) => {
    const total = rows.reduce((s, r) => s + r.n, 0);
    if (!total) return null;
    const shares = rows.map((r) => r.n / total);
    let acc = 0, half = 0;
    for (const s of shares) { acc += s; half++; if (acc >= 0.5) break; }
    return {
      total,
      hhi: Math.round(shares.reduce((s, x) => s + x * x, 0) * 10000),
      top1: shares[0] ?? 0,
      top3: shares.slice(0, 3).reduce((s, x) => s + x, 0),
      toHalf: half,
      count: rows.length,
    };
  };

  // Solo años contiguos hasta hoy: mientras el histórico se carga, evita huecos engañosos (p. ej. 1962 → 2025).
  const yrs = years.rows;
  let start = yrs.length - 1;
  while (start > 0 && yrs[start - 1].year === yrs[start].year - 1) start--;
  const contiguous = yrs.slice(Math.max(0, start));

  return {
    years: contiguous,
    countries: countries.rows,
    operators: operators.rows,
    rockets: rockets.rows,
    bases: bases.rows,
    monthly: monthly.rows,
    calendar: calendar.rows,
    coverage: coverage.rows[0],
    concOperators: conc(operators.rows),
    concCountries: conc(countries.rows),
  };
}

export async function getBackfillStatus() {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const { rows } = await db.execute<{ value: { offset: number; done: boolean; count?: number } }>(sql`
    SELECT value FROM sync_state WHERE key = 'backfill_desc'`);
  return rows[0]?.value ?? null;
}
