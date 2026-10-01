// Mapa mundial estático (servidor): continentes de Natural Earth 110m en proyección equirectangular + puntos.
// Liviano (un solo <path>) y sin JavaScript en el cliente.
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json";
import type { Topology, GeometryCollection } from "topojson-specification";

const W = 1000, H = 500;
const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;

let LAND_PATH: string | null = null;
function landPath() {
  if (LAND_PATH) return LAND_PATH;
  const topo = land as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;
  let d = "";
  for (const f of fc.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) {
      let prev: number | null = null;
      ring.forEach(([lon, lat], i) => {
        // Corta los anillos que cruzan el antimeridiano para no trazar líneas a lo ancho del mapa
        const jump = prev !== null && Math.abs(lon - prev) > 180;
        d += `${i === 0 || jump ? "M" : "L"}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`;
        prev = lon;
      });
      d += "Z";
    }
  }
  return (LAND_PATH = d);
}

export type MapDot = { lat: number; lon: number; r: number; label: string; title: string; accent?: boolean };

/** Recorta al rectángulo de los puntos (con margen) para que el mapa no sea casi todo océano. */
export function WorldDots({ dots, crop = true }: { dots: MapDot[]; crop?: boolean }) {
  let x0 = 0, y0 = 0, w = W, h = H;
  if (crop && dots.length) {
    const xs = dots.map((d) => px(d.lon)), ys = dots.map((d) => py(d.lat));
    const pad = 60;
    x0 = Math.max(0, Math.min(...xs) - pad * 2); const x1 = Math.min(W, Math.max(...xs) + pad * 2);
    y0 = Math.max(0, Math.min(...ys) - pad); const y1 = Math.min(H, Math.max(...ys) + pad);
    w = Math.max(320, x1 - x0); h = Math.max(160, y1 - y0);
    if (w / h > 2.4) { const c = y0 + h / 2; h = w / 2.4; y0 = Math.max(0, c - h / 2); }
  }
  const k = w / 1000; // tamaño de marcas y textos proporcional al recorte
  const sorted = [...dots].sort((a, b) => b.r - a.r);
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} className="block w-full" role="img" aria-label="Mapa de zonas">
      <path d={landPath()} fill="#1d1c19" stroke="#2c2b27" strokeWidth={0.6 * k} />
      {sorted.map((d) => (
        <g key={d.label + d.lat}>
          <title>{d.title}</title>
          <circle cx={px(d.lon)} cy={py(d.lat)} r={d.r * k} fill={d.accent ? "var(--color-accent)" : "#d8d5cc"} fillOpacity={0.28} />
          <circle cx={px(d.lon)} cy={py(d.lat)} r={Math.max(2.2, d.r * 0.32) * k} fill={d.accent ? "var(--color-accent)" : "#d8d5cc"} stroke="#121211" strokeWidth={1 * k} />
        </g>
      ))}
      {sorted.slice(0, 10).map((d, i) => (
        <text key={`t${d.label}`} x={px(d.lon) + (d.r * 0.4 + 6) * k} y={py(d.lat) + (i % 2 ? 12 : -6) * k} fontSize={11 * k} fill="var(--color-fg-muted)">{d.label}</text>
      ))}
    </svg>
  );
}
