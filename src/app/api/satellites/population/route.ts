import { connection } from "next/server";
import { getPopulation } from "@/lib/satellites";

// Elementos orbitales de la población visible en 3D (caché de servidor ≥ 3 h por conjunto: el navegador nunca consulta CelesTrak).
export async function GET() {
  await connection();
  const p = await getPopulation();
  if (!p) return Response.json({ error: "CelesTrak no disponible" }, { status: 503 });
  // Si falta algún conjunto, la CDN lo guarda poco tiempo para reintentar pronto
  const partial = p.sources.some((s) => s.count === null);
  const cc = partial ? "public, max-age=120, s-maxage=300" : "public, max-age=1800, s-maxage=10800, stale-while-revalidate=86400";
  return Response.json(p, { headers: { "Cache-Control": cc } });
}
