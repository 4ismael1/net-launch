// Tráfico aéreo mundial (OpenSky Network, /states/all): una sola instantánea compartida por todos los visitantes.
// Sin cuenta: ~100 consultas globales al día (cada ~15 min). Con cuenta gratuita (OPENSKY_CLIENT_ID/SECRET): cada ~100 s.
// La caché remota evita que cada instancia del servidor consulte por su cuenta (OpenSky limita por créditos).
import { cacheLife } from "next/cache";

const HAS_ACCOUNT = !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
export const GLOBAL_TTL_S = HAS_ACCOUNT ? 100 : 900; // 4 créditos por consulta: 864/día × 4 < 4 000 del plan gratuito

let token: { value: string; exp: number } | null = null;
async function bearer() {
  if (!HAS_ACCOUNT) return null;
  if (token && token.exp > Date.now() + 30_000) return token.value;
  const res = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.OPENSKY_CLIENT_ID!, client_secret: process.env.OPENSKY_CLIENT_SECRET! }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const j = await res.json();
  token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 1800) * 1000 };
  return token.value;
}

/**
 * Formato compacto (≈ 60 bytes por avión):
 * [hex, indicativo, lon, lat, altitud ft, velocidad kt, rumbo °, vertical ft/min, en tierra 0/1, segundos de antigüedad de la posición, país (índice)]
 */
export type GlobalSnapshot = { t: number; src: "opensky"; ttl: number; countries: string[]; ac: (string | number | null)[][] };

export async function getGlobalTraffic(): Promise<GlobalSnapshot | null> {
  "use cache: remote";
  cacheLife({ stale: 15, revalidate: GLOBAL_TTL_S, expire: GLOBAL_TTL_S * 6 });
  try {
    const tk = await bearer();
    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: { "User-Agent": "NET-plataforma-universitaria (UPB)", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { time: number; states: (string | number | boolean | null)[][] | null };
    const countries: string[] = [];
    const cIdx = new Map<string, number>();
    const ac: (string | number | null)[][] = [];
    for (const s of j.states ?? []) {
      const lon = s[5] as number | null, lat = s[6] as number | null;
      if (lon == null || lat == null) continue;
      const tpos = (s[3] as number | null) ?? (s[4] as number);
      if (j.time - tpos > 60) continue; // posición demasiado antigua
      const country = String(s[2] ?? "");
      let ci = cIdx.get(country);
      if (ci === undefined) { ci = countries.length; countries.push(country); cIdx.set(country, ci); }
      const alt = (s[7] as number | null) ?? (s[13] as number | null);
      const v = s[9] as number | null, vr = s[11] as number | null;
      ac.push([
        String(s[0]), String(s[1] ?? "").trim() || null, Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4,
        alt == null ? null : Math.round(alt * 3.28084), v == null ? null : Math.round(v * 1.94384), s[10] == null ? null : Math.round(s[10] as number),
        vr == null ? null : Math.round(vr * 196.85), s[8] ? 1 : 0, j.time - tpos, ci,
      ]);
    }
    return { t: j.time * 1000, src: "opensky", ttl: GLOBAL_TTL_S, countries, ac };
  } catch {
    return null;
  }
}
