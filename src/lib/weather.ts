// Clima contextual de una plataforma (Open-Meteo, gratuito, sin clave).
// NUNCA se usa para predecir cancelaciones: la decisión es de la organización responsable.
import { cacheLife } from "next/cache";

const WMO: Record<number, string> = {
  0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Cubierto",
  45: "Niebla", 48: "Niebla con escarcha", 51: "Llovizna débil", 53: "Llovizna", 55: "Llovizna intensa",
  56: "Llovizna helada", 57: "Llovizna helada intensa", 61: "Lluvia débil", 63: "Lluvia", 65: "Lluvia intensa",
  66: "Lluvia helada", 67: "Lluvia helada intensa", 71: "Nieve débil", 73: "Nieve", 75: "Nieve intensa", 77: "Granos de nieve",
  80: "Chubascos débiles", 81: "Chubascos", 82: "Chubascos fuertes", 85: "Chubascos de nieve", 86: "Chubascos de nieve fuertes",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo fuerte",
};
export const wmoLabel = (c: number | null | undefined) => (c == null ? null : WMO[c] ?? `Código ${c}`);

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const windDir = (deg: number | null | undefined) => (deg == null ? null : DIRS[Math.round(deg / 45) % 8]);

export type Weather = {
  current: { time: string; temp: number | null; wind: number | null; windDir: number | null; cloud: number | null; precip: number | null; code: number | null };
  atT0: { time: string; temp: number | null; wind: number | null; windDir: number | null; cloud: number | null; precipProb: number | null; code: number | null } | null;
  fetchedAt: string;
};

/** lat/lng redondeados a 2 decimales para compartir caché entre plataformas vecinas. */
export async function getWeather(lat: number, lng: number, t0Iso: string | null): Promise<Weather | null> {
  "use cache";
  cacheLife({ stale: 600, revalidate: 1800, expire: 7200 });
  const la = Math.round(lat * 100) / 100, lo = Math.round(lng * 100) / 100;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,weather_code` +
    `&hourly=temperature_2m,precipitation_probability,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code` +
    `&forecast_days=16&timezone=UTC&wind_speed_unit=kmh`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "NET-academic-launch-monitor" } });
    if (!res.ok) return null;
    const j = await res.json();
    const c = j.current ?? {};
    let atT0: Weather["atT0"] = null;
    if (t0Iso && j.hourly?.time?.length) {
      const target = new Date(t0Iso).getTime();
      const times: string[] = j.hourly.time;
      let best = -1, bestDiff = Infinity;
      times.forEach((t, i) => {
        const d = Math.abs(new Date(`${t}:00Z`).getTime() - target);
        if (d < bestDiff) { bestDiff = d; best = i; }
      });
      // Solo si el T0 cae dentro del horizonte del pronóstico (±1 h de una hora disponible)
      if (best >= 0 && bestDiff <= 3600_000) {
        const h = j.hourly;
        atT0 = {
          time: `${times[best]}:00Z`, temp: h.temperature_2m?.[best] ?? null, wind: h.wind_speed_10m?.[best] ?? null,
          windDir: h.wind_direction_10m?.[best] ?? null, cloud: h.cloud_cover?.[best] ?? null,
          precipProb: h.precipitation_probability?.[best] ?? null, code: h.weather_code?.[best] ?? null,
        };
      }
    }
    return {
      current: { time: `${c.time}:00Z`, temp: c.temperature_2m ?? null, wind: c.wind_speed_10m ?? null, windDir: c.wind_direction_10m ?? null, cloud: c.cloud_cover ?? null, precip: c.precipitation ?? null, code: c.weather_code ?? null },
      atT0,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null; // Open-Meteo caído → el módulo simplemente no se muestra
  }
}
