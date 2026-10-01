import { connection } from "next/server";
import { getGlobalTraffic } from "@/lib/air";

export const maxDuration = 30;

// Instantánea mundial compacta. La CDN la sirve durante unos segundos; el servidor la renueva según el cupo de OpenSky.
export async function GET() {
  await connection();
  const snap = await getGlobalTraffic();
  if (!snap) return Response.json({ error: "OpenSky no disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(snap, { headers: { "Cache-Control": "public, max-age=10, s-maxage=20, stale-while-revalidate=60" } });
}
