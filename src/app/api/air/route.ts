import { connection } from "next/server";

// Tráfico aéreo en vivo (ADS-B) para una zona. Fuentes abiertas y gratuitas, sin clave:
//   adsb.lol (ODbL) y, de respaldo, adsb.fi. No permiten CORS, así que se consultan desde aquí.
// La zona se redondea a una rejilla y la respuesta se guarda ~4 s en la CDN: muchos visitantes mirando
// la misma zona = una sola consulta a la fuente.
export const maxDuration = 15;

type Ac = {
  hex: string; flight?: string; r?: string; t?: string; desc?: string; ownOp?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; alt_geom?: number;
  gs?: number; track?: number; true_heading?: number; baro_rate?: number; geom_rate?: number; squawk?: string; emergency?: string; category?: string; seen_pos?: number;
};

const RADII = [25, 50, 100, 150, 250];
const snap = (v: number, step: number) => Math.round(v / step) * step;

export async function GET(req: Request) {
  await connection();
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lon = Number(u.searchParams.get("lon"));
  const want = Number(u.searchParams.get("r") ?? 100);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return Response.json({ error: "coordenadas no válidas" }, { status: 400 });
  const r = RADII.find((x) => x >= want) ?? 250;
  const step = r <= 50 ? 0.1 : r <= 100 ? 0.25 : 0.5;
  const qlat = snap(lat, step).toFixed(2), qlon = snap(lon, step).toFixed(2);

  const sources = [
    { name: "adsb.lol", url: `https://api.adsb.lol/v2/point/${qlat}/${qlon}/${r}`, key: "ac" },
    { name: "adsb.fi", url: `https://opendata.adsb.fi/api/v2/lat/${qlat}/lon/${qlon}/dist/${r}`, key: "aircraft" },
  ];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, { cache: "no-store", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "NET-plataforma-universitaria (UPB)" } });
      if (!res.ok) continue;
      const j = await res.json();
      const list: Ac[] = j[s.key] ?? [];
      const now = typeof j.now === "number" ? (j.now > 1e12 ? j.now : j.now * 1000) : Date.now();
      const ac = list
        .filter((a) => typeof a.lat === "number" && typeof a.lon === "number" && (a.seen_pos ?? 0) < 60)
        .map((a) => ({
          hex: a.hex, cs: a.flight?.trim() || null, reg: a.r ?? null, type: a.t ?? null, desc: a.desc ?? null, op: a.ownOp ?? null,
          lat: a.lat!, lon: a.lon!, alt: a.alt_baro === "ground" ? 0 : a.alt_baro ?? a.alt_geom ?? null, ground: a.alt_baro === "ground",
          gs: a.gs ?? null, trk: a.track ?? a.true_heading ?? null, vr: a.baro_rate ?? a.geom_rate ?? null, sq: a.squawk ?? null,
          em: a.emergency && a.emergency !== "none" ? a.emergency : null, cat: a.category ?? null, age: a.seen_pos ?? 0,
        }));
      return Response.json(
        { source: s.name, now, center: [Number(qlat), Number(qlon)], r, ac },
        { headers: { "Cache-Control": "public, max-age=2, s-maxage=4, stale-while-revalidate=6" } },
      );
    } catch {
      // siguiente fuente
    }
  }
  return Response.json({ error: "fuentes ADS-B no disponibles" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
