import { getSatellite } from "@/lib/satellites";

export async function GET(_req: Request, ctx: RouteContext<"/api/satellites/obj/[norad]">) {
  const n = Number((await ctx.params).norad);
  if (!Number.isInteger(n) || n <= 0) return Response.json({ error: "NORAD inválido" }, { status: 400 });
  const d = await getSatellite(n);
  if (!d.omm) return Response.json({ error: "sin elementos" }, { status: d.unavailable ? 503 : 404 });
  return Response.json(d.omm);
}
