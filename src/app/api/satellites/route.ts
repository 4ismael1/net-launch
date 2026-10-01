import { searchSatellites } from "@/lib/satellites";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 40) ?? "";
  const rows = await searchSatellites(q.toUpperCase());
  // Si CelesTrak no responde, el cliente muestra "búsqueda no disponible" en vez de "sin resultados"
  if (!rows) return Response.json({ error: "CelesTrak no disponible" }, { status: 503 });
  return Response.json(rows.map((o) => ({ norad: o.NORAD_CAT_ID, name: o.OBJECT_NAME, id: o.OBJECT_ID })));
}
