import { getPadActivity } from "@/lib/data/map";

export async function GET(_req: Request, ctx: RouteContext<"/api/pads/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return Response.json({ error: "id inválido" }, { status: 400 });
  return Response.json(await getPadActivity(id));
}
