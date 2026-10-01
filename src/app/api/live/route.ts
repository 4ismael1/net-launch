import { after, connection } from "next/server";
import { revalidateTag } from "next/cache";
import { getLaunchLive, getLiveState } from "@/lib/data/live";
import { markAttempt, minutesSinceLastAttempt, minutesSinceLastSync, runSync } from "@/lib/sync/run";

export const maxDuration = 60;

// Por instancia: como mucho una comprobación en la BD por minuto (el latido llega cada 20–60 s desde cada pestaña)
let lastCheck = 0;

// Latido: estado mínimo para actualizar la interfaz en vivo (sin recargar la página).
// Además, si los datos tienen más de 15 min, lanza una sincronización en segundo plano DESPUÉS de responder
// (respaldo si el cron no se ejecuta). El candado en la BD evita solapes y el presupuesto de LL2 se respeta.
export async function GET(req: Request) {
  await connection();
  const slug = new URL(req.url).searchParams.get("slug");
  const [state, launch] = await Promise.all([getLiveState(), slug ? getLaunchLive(slug.slice(0, 200)) : null]);

  after(async () => {
    try {
      // Atajo sin consultas: el estado (en caché) ya dice que la última sincronización es reciente
      if (state.lastSync && Date.now() - Date.parse(state.lastSync) < 15 * 60_000) return;
      if (Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      const m = await minutesSinceLastSync();
      if (m !== null && m < 15) return;
      // Como mucho un intento cada 10 min, aunque haya muchos visitantes a la vez
      const last = await minutesSinceLastAttempt();
      if (last !== null && last < 10) return;
      await markAttempt();
      const r = await runSync({ source: "web", deadlineMs: 40_000, maxTranslateRequests: 2 });
      if (r.upserted > 0 || (r.catalog ?? 0) > 0) revalidateTag("ll2", "max");
    } catch (e) {
      console.error("autosync", e);
    }
  });

  return Response.json({ ...state, launch, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
