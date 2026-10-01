import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { HtmlFlag } from "@/components/ui/HtmlFlag";
import { Streamed } from "@/components/ui/Streamed";
import { AirTraffic, type AirPreset } from "@/components/map/AirTraffic";

export const metadata: Metadata = { title: "Tráfico aéreo" };

const FIXED: AirPreset[] = [
  { name: "Medellín", lat: 6.2, lon: -75.5, z: 8 },
  { name: "Vista mundial", lat: 20, lon: -40, z: 1.8 },
  { name: "Bogotá", lat: 4.7, lon: -74.15, z: 8 },
  { name: "Cabo Cañaveral", lat: 28.5, lon: -80.6, z: 8 },
  { name: "Ciudad de México", lat: 19.43, lon: -99.1, z: 8 },
  { name: "Madrid", lat: 40.47, lon: -3.56, z: 8 },
  { name: "Nueva York", lat: 40.7, lon: -73.9, z: 8 },
];

// Próximas bases de lanzamiento (24 h): para ver el espacio aéreo alrededor durante la ventana
async function launchPresets(): Promise<AirPreset[]> {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const { rows } = await db.execute<{ name: string; lat: number; lon: number; launch: string }>(sql`
    SELECT DISTINCT ON (p.id) COALESCE(loc.name, p.name) AS name, p.latitude lat, p.longitude lon, l.name launch
    FROM launches l JOIN pads p ON p.id = l.pad_id LEFT JOIN locations loc ON loc.id = p.location_id
    WHERE l.net BETWEEN now() - interval '1 hour' AND now() + interval '36 hours'
      AND l.status_abbrev IN ('Go','TBC','TBD','Hold','In Flight') AND p.latitude IS NOT NULL
    ORDER BY p.id, l.net LIMIT 3`);
  return rows.map((r) => ({ name: r.name.split(",")[0], lat: r.lat, lon: r.lon, z: 8, launch: r.launch }));
}

export default function Page() {
  return (
    <div data-fullbleed className="-mx-4 -mt-5 -mb-24 md:-mx-6 md:-mb-10">
      <HtmlFlag name="fullbleed" />
      <Streamed fallback={<div className="h-[calc(100dvh-56px)] bg-bg" />}>
        <Content />
      </Streamed>
    </div>
  );
}

async function Content() {
  // Sin duplicados: dos bases a menos de ~1° (p. ej. Cabo Cañaveral y Kennedy) comparten espacio aéreo
  const near = (a: AirPreset, b: AirPreset) => Math.abs(a.lat - b.lat) < 1 && Math.abs(a.lon - b.lon) < 1;
  const presets: AirPreset[] = [];
  for (const p of [...(await launchPresets()), ...FIXED]) if (!presets.some((q) => near(p, q))) presets.push(p);
  return <AirTraffic presets={presets} initial={{ name: "Américas", lat: 12, lon: -75, z: 3.2 }} />;
}
