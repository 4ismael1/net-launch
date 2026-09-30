import { globalSearch } from "@/lib/data/explore";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (q.length < 2) return Response.json({ launches: [], orgs: [], rockets: [], bases: [] });
  return Response.json(await globalSearch(q.toLowerCase()));
}
