import { revalidateTag } from "next/cache";

// El sincronizador llama aquí tras actualizar la BD.
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag("ll2", "max");
  return Response.json({ ok: true });
}
