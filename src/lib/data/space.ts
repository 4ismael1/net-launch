// Eventos y "En el espacio": instantáneas de LL2 guardadas por el sincronizador en sync_state.
import { cacheLife, cacheTag } from "next/cache";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function snaps() {
  const rows = await db.select().from(schema.syncState).where(inArray(schema.syncState.key, ["snap_events", "snap_space"]));
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value as any]));
  return { events: m.snap_events ?? null, space: m.snap_space ?? null };
}

export type SpaceEvent = {
  id: number; slug: string; name: string; type: string | null; date: string | null; precision: string | null;
  location: string | null; description: string | null; imageUrl: string | null; webcastLive: boolean;
  videos: { url: string; title: string | null; publisher: string | null; official: boolean }[];
  links: { url: string; title: string | null }[];
};

const ev = (e: any): SpaceEvent => ({
  id: e.id, slug: e.slug, name: e.name, type: e.type?.name ?? null, date: e.date ?? null, precision: e.date_precision?.abbrev ?? null,
  location: e.location || null, description: e.description || null, imageUrl: e.image?.thumbnail_url ?? e.image?.image_url ?? null,
  webcastLive: !!e.webcast_live,
  videos: (e.vid_urls ?? []).map((v: any) => ({ url: v.url, title: v.title ?? null, publisher: v.publisher ?? null, official: /^official/i.test(v.type?.name ?? "") })),
  links: (e.info_urls ?? []).map((u: any) => ({ url: u.url, title: u.title ?? u.source ?? null })),
});

export async function getEvents() {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  const { events } = await snaps();
  if (!events) return null;
  return {
    upcoming: (events.upcoming ?? []).map(ev) as SpaceEvent[],
    previous: (events.previous ?? []).map(ev) as SpaceEvent[],
    at: events.at as number,
  };
}

export type Astronaut = {
  id: number; name: string; status: string | null; agency: string | null; agencyAbbrev: string | null; agencyId: number | null; nationality: string[];
  imageUrl: string | null; timeInSpace: string | null; lastFlight: string | null; flights: number | null; spacewalks: number | null; wiki: string | null;
  bio: string | null; age: number | null; firstFlight: string | null; evaTime: string | null; role: string | null; stationId: number | null;
};
export type Station = {
  id: number; name: string; orbit: string | null; founded: string | null; description: string | null; imageUrl: string | null;
  owners: { id: number; name: string }[]; crew: number | null; docked: number | null; expeditions: { name: string; start: string | null }[];
  mass: number | null; volume: number | null;
  ports: { name: string; vehicle: string | null; image: string | null; since: string | null }[];
  height: number | null; width: number | null;
};

export async function getInSpace() {
  "use cache";
  cacheTag("ll2");
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  const { space } = await snaps();
  if (!space) return null;
  // Tripulación por estación (expediciones activas): rol y estación de cada persona
  const crewInfo = new Map<number, { role: string | null; stationId: number | null }>();
  for (const e of space.expeditions ?? []) {
    for (const m of e.crew ?? []) if (m.astronaut?.id) crewInfo.set(m.astronaut.id, { role: m.role?.role ?? null, stationId: e.spacestation?.id ?? null });
  }
  // "Non-Human" (p. ej. Starman, el maniquí del Tesla de Falcon Heavy) no es una persona en el espacio
  const astronauts: Astronaut[] = (space.astronauts ?? []).filter((a: any) => a.type?.name !== "Non-Human").map((a: any) => ({
    id: a.id as number,
    name: a.name as string,
    status: a.status?.name ?? null,
    agency: a.agency?.name ?? null,
    agencyAbbrev: a.agency?.abbrev ?? null,
    agencyId: a.agency?.id ?? null,
    nationality: (a.nationality ?? []).map((n: any) => n.alpha_3_code).filter(Boolean) as string[],
    imageUrl: a.image?.thumbnail_url ?? a.image?.image_url ?? null,
    timeInSpace: a.time_in_space ?? null,
    lastFlight: a.last_flight ?? null,
    flights: a.flights_count ?? null,
    spacewalks: a.spacewalks_count ?? null,
    wiki: a.wiki || null,
    bio: a.bio || null,
    age: a.age ?? null,
    firstFlight: a.first_flight ?? null,
    evaTime: a.eva_time ?? null,
    role: crewInfo.get(a.id)?.role ?? null,
    stationId: crewInfo.get(a.id)?.stationId ?? null,
  }));
  const stations: Station[] = (space.stations ?? []).map((s: any) => ({
    id: s.id as number,
    name: s.name as string,
    orbit: s.orbit ?? null,
    founded: s.founded ?? null,
    description: s.description ?? null,
    imageUrl: s.image?.image_url ?? null,
    owners: (s.owners ?? []).map((o: any) => ({ id: o.id, name: o.name })) as { id: number; name: string }[],
    crew: s.onboard_crew ?? null,
    docked: s.docked_vehicles ?? null,
    expeditions: (s.active_expeditions ?? []).map((e: any) => ({ name: e.name, start: e.start ?? null })) as { name: string; start: string | null }[],
    mass: s.mass ?? null,
    volume: s.volume ?? null,
    height: s.height ?? null,
    width: s.width ?? null,
    // LL2 2.3.0: docking_location[].currently_docked.{flight_vehicle_chaser.spacecraft | space_station_chaser}
    ports: (s.docking_location ?? []).map((d: any) => {
      const cd = d.currently_docked ?? d.docked ?? null;
      const sc = cd?.flight_vehicle_chaser?.spacecraft ?? cd?.flight_vehicle?.spacecraft ?? null;
      return {
        name: d.name,
        vehicle: sc?.name ?? cd?.space_station_chaser?.name ?? null,
        image: sc?.image?.thumbnail_url ?? sc?.image?.image_url ?? null,
        since: cd?.docking ?? null,
      };
    }),
  }));
  return { astronauts, stations, at: space.at as number };
}

/** "P430DT6H57M4S" → días en el espacio. */
export function isoDays(d: string | null) {
  const m = d && /^P(?:(\d+)D)?/.exec(d);
  return m ? Number(m[1] ?? 0) : null;
}
