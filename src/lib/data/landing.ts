// Datos reales para la portada narrativa. Nada de cifras decorativas.
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getKpis, getNextLaunch, getPadPoints } from "./launches";
import { getStats } from "./stats";

// Paradas del recorrido: bases de regiones distintas (se buscan por nombre en los datos).
const TOUR = [
  { match: "Cape Canaveral", region: "Florida, Estados Unidos" },
  { match: "Kourou", region: "Guayana Francesa" },
  { match: "Baikonur", region: "Kazajistán" },
  { match: "Jiuquan", region: "Gansu, China" },
  { match: "Satish Dhawan", region: "Andhra Pradesh, India" },
  { match: "Tanegashima", region: "Kagoshima, Japón" },
  { match: "Mahia", region: "Nueva Zelanda" },
];

export async function getLandingData() {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const [next, pads, kpis, stats, agencies, stops] = await Promise.all([
    getNextLaunch(),
    getPadPoints(),
    getKpis(),
    getStats("12m"),
    db.execute<{ name: string; abbrev: string | null }>(sql`
      SELECT a.name, a.abbrev FROM agencies a
      WHERE EXISTS (SELECT 1 FROM launches l WHERE l.provider_id = a.id AND l.net > now() - interval '3 years')
      ORDER BY md5(a.name) LIMIT 22`),
    Promise.all(
      TOUR.map(async (t) => {
        const { rows } = await db.execute<{ id: number; name: string; lat: number; lng: number; total: number; upcoming: number; operators: string[] }>(sql`
          SELECT loc.id, loc.name, loc.latitude AS lat, loc.longitude AS lng,
            GREATEST(COALESCE(loc.total_launch_count, 0), (SELECT count(*) FROM launches l WHERE l.location_id = loc.id))::int AS total,
            (SELECT count(*)::int FROM launches l WHERE l.location_id = loc.id AND l.net > now() AND l.status_abbrev IN ('Go','TBC','TBD','Hold')) AS upcoming,
            ARRAY(SELECT DISTINCT a.name FROM launches l JOIN agencies a ON a.id = l.provider_id
                  WHERE l.location_id = loc.id AND l.net > now() - interval '3 years' LIMIT 4) AS operators
          FROM locations loc WHERE loc.name ILIKE ${"%" + t.match + "%"} AND loc.latitude IS NOT NULL
          ORDER BY loc.total_launch_count DESC NULLS LAST LIMIT 1`);
        return rows[0] ? { ...rows[0], region: t.region } : null;
      }),
    ),
  ]);

  return {
    next,
    pads: pads.map((p) => ({ lat: p.lat, lng: p.lng, total: p.total ?? 0, upcoming: p.upcoming })),
    kpis,
    conc: stats.concOperators,
    topOperator: stats.operators[0]?.name ?? null,
    fragments: agencies.rows.map((a) => a.abbrev && a.abbrev.length <= 8 ? a.abbrev : a.name),
    stops: stops.filter((s): s is NonNullable<typeof s> => !!s),
  };
}

export type LandingData = Awaited<ReturnType<typeof getLandingData>>;
