import { getGroup, isGroup } from "@/lib/satellites";

// Elementos de un grupo (caché de servidor ≥ 3 h: el navegador nunca consulta CelesTrak directamente).
export async function GET(_req: Request, ctx: RouteContext<"/api/satellites/group/[g]">) {
  const { g } = await ctx.params;
  if (!isGroup(g)) return Response.json({ error: "grupo desconocido" }, { status: 404 });
  const rows = await getGroup(g);
  if (rows === null) return Response.json({ error: "CelesTrak no disponible" }, { status: 503 });
  return Response.json(rows, { headers: { "Cache-Control": "public, max-age=1800, s-maxage=10800, stale-while-revalidate=86400" } });
}
