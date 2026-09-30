// Convierte respuestas de LL2 2.3.0 (modes normal/detailed) en filas de la BD.
// Regla: nunca inventar; lo que no viene queda en null.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const d = (s: string | null | undefined) => (s ? new Date(s) : null);
const s = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normAgency(a: Any) {
  if (!a?.id) return null;
  return {
    id: a.id as number,
    name: a.name as string,
    abbrev: s(a.abbrev),
    type: s(a.type?.name),
    countryCodes: Array.isArray(a.country) ? a.country.map((c: Any) => c.alpha_3_code).filter(Boolean) : null,
    description: s(a.description),
    foundingYear: n(a.founding_year),
    logoUrl: s(a.logo?.image_url),
    imageUrl: s(a.image?.image_url),
    infoUrl: s(a.info_url),
    wikiUrl: s(a.wiki_url),
    totalLaunchCount: n(a.total_launch_count),
    successfulLaunches: n(a.successful_launches),
    failedLaunches: n(a.failed_launches),
    pendingLaunches: n(a.pending_launches),
    // Solo guardamos raw si es la versión completa del objeto
    raw: a.response_mode === "detailed" || "description" in a ? a : null,
  };
}

export function normLocation(l: Any) {
  if (!l?.id) return null;
  return {
    id: l.id as number,
    name: l.name as string,
    countryCode: s(l.country?.alpha_3_code),
    countryName: s(l.country?.name),
    latitude: n(l.latitude),
    longitude: n(l.longitude),
    timezone: s(l.timezone_name),
    description: s(l.description),
    imageUrl: s(l.image?.image_url),
    mapImage: s(l.map_image),
    totalLaunchCount: n(l.total_launch_count),
    active: typeof l.active === "boolean" ? l.active : null,
    raw: l,
  };
}

export function normPad(p: Any) {
  if (!p?.id) return null;
  return {
    id: p.id as number,
    locationId: n(p.location?.id),
    name: p.name as string,
    countryCode: s(p.country?.alpha_3_code) ?? s(p.location?.country?.alpha_3_code),
    latitude: n(p.latitude),
    longitude: n(p.longitude),
    active: typeof p.active === "boolean" ? p.active : null,
    description: s(p.description),
    imageUrl: s(p.image?.image_url),
    mapUrl: s(p.map_url),
    wikiUrl: s(p.wiki_url),
    totalLaunchCount: n(p.total_launch_count),
    raw: { ...p, location: p.location ? { id: p.location.id } : null },
  };
}

export function normRocketConfig(c: Any) {
  if (!c?.id) return null;
  return {
    id: c.id as number,
    name: c.name as string,
    fullName: s(c.full_name),
    family: s(c.families?.[0]?.name),
    variant: s(c.variant),
    manufacturerId: n(c.manufacturer?.id),
    active: typeof c.active === "boolean" ? c.active : null,
    reusable: typeof c.reusable === "boolean" ? c.reusable : null,
    description: s(c.description),
    imageUrl: s(c.image?.image_url),
    wikiUrl: s(c.wiki_url),
    length: n(c.length),
    diameter: n(c.diameter),
    leoCapacity: n(c.leo_capacity),
    gtoCapacity: n(c.gto_capacity),
    maidenFlight: s(c.maiden_flight),
    totalLaunchCount: n(c.total_launch_count),
    successfulLaunches: n(c.successful_launches),
    failedLaunches: n(c.failed_launches),
    raw: c,
  };
}

export function normLaunch(l: Any) {
  const detailed = l.response_mode === "detailed";
  const pad = l.pad;
  return {
    launch: {
      id: l.id as string,
      slug: l.slug as string,
      name: l.name as string,
      statusId: n(l.status?.id),
      statusAbbrev: s(l.status?.abbrev),
      statusName: s(l.status?.name),
      net: d(l.net),
      netPrecision: s(l.net_precision?.abbrev),
      windowStart: d(l.window_start),
      windowEnd: d(l.window_end),
      providerId: n(l.launch_service_provider?.id),
      rocketConfigId: n(l.rocket?.configuration?.id),
      padId: n(pad?.id),
      locationId: n(pad?.location?.id),
      countryCode: s(pad?.country?.alpha_3_code) ?? s(pad?.location?.country?.alpha_3_code),
      missionName: s(l.mission?.name),
      missionType: s(l.mission?.type),
      missionDescription: s(l.mission?.description),
      orbitName: s(l.mission?.orbit?.name),
      orbitAbbrev: s(l.mission?.orbit?.abbrev),
      launchDesignator: s(l.launch_designator),
      imageUrl: s(l.image?.image_url),
      thumbnailUrl: s(l.image?.thumbnail_url),
      imageCredit: s(l.image?.credit),
      failReason: s(l.failreason),
      webcastLive: typeof l.webcast_live === "boolean" ? l.webcast_live : null,
      probability: n(l.probability),
      detailed,
      raw: l,
      ll2LastUpdated: d(l.last_updated),
    },
    agencies: [
      l.launch_service_provider,
      ...(l.mission?.agencies ?? []),
      ...(pad?.agencies ?? []),
      l.rocket?.configuration?.manufacturer,
    ]
      .map(normAgency)
      .filter((x): x is NonNullable<ReturnType<typeof normAgency>> => !!x),
    location: normLocation(pad?.location),
    pad: normPad(pad),
    rocketConfig: normRocketConfig(l.rocket?.configuration),
    videos: detailed
      ? ((l.vid_urls ?? []) as Any[])
          .filter((v) => s(v.url))
          .map((v) => ({
            launchId: l.id as string,
            url: v.url as string,
            title: s(v.title),
            publisher: s(v.publisher),
            source: s(v.source),
            typeName: s(v.type?.name),
            language: s(v.language?.code),
            featureImage: s(v.feature_image),
            startTime: d(v.start_time),
            live: typeof v.live === "boolean" ? v.live : null,
            priority: n(v.priority),
          }))
      : null,
    links: detailed
      ? ((l.info_urls ?? []) as Any[])
          .filter((u) => s(u.url))
          .map((u) => ({
            launchId: l.id as string,
            url: u.url as string,
            title: s(u.title),
            source: s(u.source),
            typeName: s(u.type?.name),
          }))
      : null,
  };
}
