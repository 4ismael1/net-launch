import { cacheLife, cacheTag } from "next/cache";
import { asc, desc, eq, sql, and, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { launches: L, agencies: A, rocketConfigs: R, pads: P, locations: LOC, launchVideos: V, launchLinks: K } = schema;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Update = { id: number; comment: string; info_url: string | null; created_by: string | null; created_on: string };
export type TimelineItem = { abbrev: string; description: string | null; relative: string };

/** Convierte "-PT1H30M" / "PT8M30S" en segundos relativos a T0. */
function isoDurationToSec(d: string) {
  const m = /^(-)?P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d);
  if (!m) return null;
  const s = (+(m[2] ?? 0)) * 86400 + (+(m[3] ?? 0)) * 3600 + (+(m[4] ?? 0)) * 60 + +(m[5] ?? 0);
  return m[1] ? -s : s;
}

export async function getLaunchDetail(slug: string) {
  "use cache";
  cacheTag("ll2", `launch:${slug}`);
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const [row] = await db
    .select({
      l: L,
      provider: { id: A.id, name: A.name, abbrev: A.abbrev, type: A.type, logoUrl: A.logoUrl, countryCodes: A.countryCodes },
      rocket: { id: R.id, name: R.name, fullName: R.fullName, family: R.family, variant: R.variant, imageUrl: R.imageUrl, reusable: R.reusable, totalLaunchCount: R.totalLaunchCount, successfulLaunches: R.successfulLaunches },
      pad: { id: P.id, name: P.name, latitude: P.latitude, longitude: P.longitude, mapUrl: P.mapUrl, totalLaunchCount: P.totalLaunchCount },
      location: { id: LOC.id, name: LOC.name, timezone: LOC.timezone, countryCode: LOC.countryCode },
    })
    .from(L)
    .leftJoin(A, eq(L.providerId, A.id))
    .leftJoin(R, eq(L.rocketConfigId, R.id))
    .leftJoin(P, eq(L.padId, P.id))
    .leftJoin(LOC, eq(L.locationId, LOC.id))
    .where(eq(L.slug, slug))
    .limit(1);
  if (!row) return null;

  const [videos, links] = await Promise.all([
    db.select().from(V).where(eq(V.launchId, row.l.id)).orderBy(desc(V.priority)),
    db.select().from(K).where(eq(K.launchId, row.l.id)),
  ]);

  const raw = (row.l.raw ?? {}) as any;
  const updates: Update[] = (raw.updates ?? []).map((u: any) => ({
    id: u.id, comment: u.comment, info_url: u.info_url || null, created_by: u.created_by ?? null, created_on: u.created_on,
  }));
  const timeline: (TimelineItem & { sec: number })[] = (raw.timeline ?? [])
    .map((t: any) => ({ abbrev: t.type?.abbrev, description: t.type?.description ?? null, relative: t.relative_time, sec: isoDurationToSec(t.relative_time ?? "") }))
    .filter((t: any) => t.abbrev && t.sec !== null)
    .sort((a: any, b: any) => a.sec - b.sec);
  const programs: { id: number; name: string }[] = (raw.program ?? []).map((p: any) => ({ id: p.id, name: p.name }));
  const missionAgencies: { id: number; name: string }[] = (raw.mission?.agencies ?? []).map((a: any) => ({ id: a.id, name: a.name }));
  const patches: { name: string; url: string }[] = (raw.mission_patches ?? []).map((p: any) => ({ name: p.name, url: p.image_url })).filter((p: any) => p.url);

  const { raw: _omit, ...launch } = row.l;
  void _omit;
  return {
    ...row,
    l: launch,
    videos,
    links,
    updates,
    timeline,
    programs,
    missionAgencies,
    patches,
    weatherConcerns: (raw.weather_concerns as string | null) || null,
    flightclubUrl: (raw.flightclub_url as string | null) || null,
    hashtag: (raw.hashtag as string | null) || null,
    attempts: {
      orbitalYear: raw.orbital_launch_attempt_count_year ?? null,
      agencyYear: raw.agency_launch_attempt_count_year ?? null,
      padTotal: raw.pad_launch_attempt_count ?? null,
    },
  };
}

export type LaunchDetail = NonNullable<Awaited<ReturnType<typeof getLaunchDetail>>>;

/** Slugs a pre-renderizar en el build: los próximos más cercanos. */
export async function getPrerenderSlugs(limit = 30) {
  "use cache";
  cacheLife("hours");
  const rows = await db
    .select({ slug: L.slug })
    .from(L)
    .where(and(sql`${L.net} > now()`, inArray(L.statusAbbrev, ["Go", "TBC", "TBD", "Hold"])))
    .orderBy(asc(L.net))
    .limit(limit);
  return rows.map((r) => r.slug);
}
