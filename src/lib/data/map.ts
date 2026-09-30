import { cacheLife, cacheTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { padName } from "@/lib/format";

export type MapPad = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  locationId: number | null;
  locationName: string | null;
  country: string | null;
  active: boolean | null;
  total: number;
  upcoming: number;
  recent: number; // últimos 12 meses
  providers: number[];
  nextName: string | null;
  nextSlug: string | null;
  nextNet: string | null;
  nextPrecision: string | null;
  nextStatus: string | null;
};

export type MapOperator = { id: number; name: string; abbrev: string | null };

/** Todas las plataformas con coordenadas + actividad agregada, para el WebGIS. */
export async function getMapData() {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const { rows: pads } = await db.execute<MapPad>(sql`
    WITH act AS (
      SELECT pad_id,
        count(*) FILTER (WHERE net > now() AND status_abbrev IN ('Go','TBC','TBD','Hold'))::int AS upcoming,
        count(*) FILTER (WHERE net BETWEEN now() - interval '365 days' AND now())::int AS recent,
        count(*)::int AS known,
        array_agg(DISTINCT provider_id) FILTER (WHERE provider_id IS NOT NULL AND net > now() - interval '3 years') AS providers
      FROM launches WHERE pad_id IS NOT NULL GROUP BY pad_id
    ), nxt AS (
      SELECT DISTINCT ON (pad_id) pad_id, name, slug, net, net_precision, status_abbrev
      FROM launches
      WHERE net > now() - interval '3 hours' AND status_abbrev IN ('Go','TBC','TBD','Hold','In Flight')
      ORDER BY pad_id, net
    )
    SELECT p.id, p.name, p.latitude AS lat, p.longitude AS lng, p.location_id AS "locationId",
           loc.name AS "locationName", COALESCE(p.country_code, loc.country_code) AS country, p.active,
           GREATEST(COALESCE(p.total_launch_count, 0), COALESCE(act.known, 0))::int AS total,
           COALESCE(act.upcoming, 0) AS upcoming, COALESCE(act.recent, 0) AS recent,
           COALESCE(act.providers, '{}') AS providers,
           nxt.name AS "nextName", nxt.slug AS "nextSlug", nxt.net AS "nextNet",
           nxt.net_precision AS "nextPrecision", nxt.status_abbrev AS "nextStatus"
    FROM pads p
    LEFT JOIN locations loc ON loc.id = p.location_id
    LEFT JOIN act ON act.pad_id = p.id
    LEFT JOIN nxt ON nxt.pad_id = p.id
    WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND (COALESCE(p.total_launch_count, 0) > 0 OR act.known > 0)`);

  const { rows: operators } = await db.execute<MapOperator>(sql`
    SELECT DISTINCT a.id, a.name, a.abbrev FROM agencies a
    JOIN launches l ON l.provider_id = a.id
    WHERE l.net > now() - interval '3 years' AND l.pad_id IS NOT NULL
    ORDER BY a.name`);

  return { pads: pads.map((p) => ({ ...p, name: padName(p.name)!, nextNet: p.nextNet ? new Date(p.nextNet).toISOString() : null })), operators };
}

/** Detalle de una plataforma para el panel lateral del mapa. */
export async function getPadActivity(padId: number) {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const { rows } = await db.execute<{
    slug: string; name: string; net: string | null; net_precision: string | null; status_abbrev: string | null;
    provider: string | null; rocket: string | null; kind: "upcoming" | "recent";
  }>(sql`
    (SELECT l.slug, l.name, l.net, l.net_precision, l.status_abbrev, a.name AS provider, r.name AS rocket, 'upcoming' AS kind
     FROM launches l LEFT JOIN agencies a ON a.id = l.provider_id LEFT JOIN rocket_configs r ON r.id = l.rocket_config_id
     WHERE l.pad_id = ${padId} AND l.net > now() - interval '3 hours' AND l.status_abbrev IN ('Go','TBC','TBD','Hold','In Flight')
     ORDER BY l.net ASC LIMIT 6)
    UNION ALL
    (SELECT l.slug, l.name, l.net, l.net_precision, l.status_abbrev, a.name, r.name, 'recent'
     FROM launches l LEFT JOIN agencies a ON a.id = l.provider_id LEFT JOIN rocket_configs r ON r.id = l.rocket_config_id
     WHERE l.pad_id = ${padId} AND l.status_abbrev IN ('Success','Failure','Partial Failure')
     ORDER BY l.net DESC LIMIT 6)`);
  return rows.map((r) => ({ ...r, net: r.net ? new Date(r.net).toISOString() : null }));
}
