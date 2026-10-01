import { connection } from "next/server";
import { revalidateTag } from "next/cache";
import { runSync } from "@/lib/sync/run";

export const maxDuration = 60;

// Cron de Vercel (vercel.json). Vercel envía "Authorization: Bearer $CRON_SECRET" automáticamente.
export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
  const r = await runSync({ source: "cron", deadlineMs: 50_000, maxTranslateRequests: 3 });
  if (r.upserted > 0 || (r.catalog ?? 0) > 0) revalidateTag("ll2", "max");
  return Response.json(r);
}
