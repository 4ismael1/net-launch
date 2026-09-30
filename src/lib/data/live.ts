// Estado "en vivo" mínimo que consulta el navegador cada 20–60 s (latido). Lee de nuestra BD, nunca de LL2.
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getNextLaunch } from "./launches";

export type LiveLaunch = {
  id: string; slug: string; name: string; missionName: string | null; statusAbbrev: string | null; statusName: string | null;
  net: string | null; netPrecision: string | null; webcastLive: boolean | null; rocketName: string | null; rocketFullName: string | null;
  providerName: string | null; providerType: string | null; locationName: string | null; padName: string | null; padId: number | null;
  countryCode: string | null; imageUrl: string | null; orbitName: string | null; missionType: string | null;
  watch: Watch | null;
};
export type Watch = { url: string; official: boolean; publisher: string | null };
export type LiveState = { next: LiveLaunch | null; lastSync: string | null; serverTime: string };

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Mejor transmisión de un lanzamiento: oficial primero, luego por prioridad de LL2. */
async function bestWatch(launchId: string): Promise<Watch | null> {
  const rows = await db.select({ url: schema.launchVideos.url, type: schema.launchVideos.typeName, publisher: schema.launchVideos.publisher, priority: schema.launchVideos.priority, live: schema.launchVideos.live })
    .from(schema.launchVideos).where(eq(schema.launchVideos.launchId, launchId));
  const official = (t: string | null) => !!t && /^official/i.test(t);
  const best = rows.sort((a, b) => Number(official(b.type)) - Number(official(a.type)) || Number(!!b.live) - Number(!!a.live) || (b.priority ?? 0) - (a.priority ?? 0))[0];
  return best ? { url: best.url, official: official(best.type), publisher: best.publisher } : null;
}

export async function getLiveState(): Promise<Omit<LiveState, "serverTime">> {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 15, revalidate: 30, expire: 300 });
  const [n, [sync]] = await Promise.all([
    getNextLaunch(),
    db.select({ at: schema.syncRuns.finishedAt }).from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.ok, true), sql`${schema.syncRuns.requests} > 0`))
      .orderBy(desc(schema.syncRuns.finishedAt)).limit(1),
  ]);
  const watch = n ? await bestWatch(n.id) : null;
  return {
    next: n ? {
      id: n.id, slug: n.slug, name: n.name, missionName: n.missionName, statusAbbrev: n.statusAbbrev, statusName: n.statusName,
      net: iso(n.net), netPrecision: n.netPrecision, webcastLive: n.webcastLive, rocketName: n.rocketName, rocketFullName: n.rocketFullName,
      providerName: n.providerName, providerType: n.providerType, locationName: n.locationName, padName: n.padName, padId: n.padId,
      countryCode: n.countryCode, imageUrl: n.imageUrl, orbitName: n.orbitName, missionType: n.missionType, watch,
    } : null,
    lastSync: iso(sync?.at),
  };
}

/** Estado de un lanzamiento concreto (página de misión). */
export async function getLaunchLive(slug: string) {
  "use cache";
  cacheTag("ll2", `launch:${slug}`);
  cacheLife({ stale: 15, revalidate: 30, expire: 300 });
  const [r] = await db.select({ id: schema.launches.id, statusAbbrev: schema.launches.statusAbbrev, statusName: schema.launches.statusName, net: schema.launches.net,
    netPrecision: schema.launches.netPrecision, webcastLive: schema.launches.webcastLive, failReason: schema.launches.failReason })
    .from(schema.launches).where(eq(schema.launches.slug, slug)).limit(1);
  if (!r) return null;
  const { id, ...rest } = r;
  return { ...rest, net: iso(r.net), watch: await bestWatch(id) };
}
