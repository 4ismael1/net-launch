import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const agencies = pgTable(
  "agencies",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    abbrev: text("abbrev"),
    type: text("type"),
    countryCodes: text("country_codes").array(), // alpha-3
    description: text("description"),
    descriptionEs: text("description_es"),
    foundingYear: integer("founding_year"),
    logoUrl: text("logo_url"),
    imageUrl: text("image_url"),
    infoUrl: text("info_url"),
    wikiUrl: text("wiki_url"),
    totalLaunchCount: integer("total_launch_count"),
    successfulLaunches: integer("successful_launches"),
    failedLaunches: integer("failed_launches"),
    pendingLaunches: integer("pending_launches"),
    raw: jsonb("raw"),
    updatedAt: tstz("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agencies_name_idx").on(t.name)],
);

export const locations = pgTable("locations", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  timezone: text("timezone"),
  description: text("description"),
  imageUrl: text("image_url"),
  mapImage: text("map_image"),
  totalLaunchCount: integer("total_launch_count"),
  active: boolean("active"),
  raw: jsonb("raw"),
  updatedAt: tstz("updated_at").defaultNow().notNull(),
});

export const pads = pgTable(
  "pads",
  {
    id: integer("id").primaryKey(),
    locationId: integer("location_id").references(() => locations.id),
    name: text("name").notNull(),
    countryCode: text("country_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    active: boolean("active"),
    description: text("description"),
    imageUrl: text("image_url"),
    mapUrl: text("map_url"),
    wikiUrl: text("wiki_url"),
    totalLaunchCount: integer("total_launch_count"),
    raw: jsonb("raw"),
    updatedAt: tstz("updated_at").defaultNow().notNull(),
  },
  (t) => [index("pads_location_idx").on(t.locationId)],
);

export const rocketConfigs = pgTable("rocket_configs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  fullName: text("full_name"),
  family: text("family"),
  variant: text("variant"),
  manufacturerId: integer("manufacturer_id"),
  active: boolean("active"),
  reusable: boolean("reusable"),
  description: text("description"),
  imageUrl: text("image_url"),
  wikiUrl: text("wiki_url"),
  length: doublePrecision("length"),
  diameter: doublePrecision("diameter"),
  leoCapacity: doublePrecision("leo_capacity"),
  gtoCapacity: doublePrecision("gto_capacity"),
  maidenFlight: text("maiden_flight"),
  totalLaunchCount: integer("total_launch_count"),
  successfulLaunches: integer("successful_launches"),
  failedLaunches: integer("failed_launches"),
  raw: jsonb("raw"),
  updatedAt: tstz("updated_at").defaultNow().notNull(),
});

export const launches = pgTable(
  "launches",
  {
    id: text("id").primaryKey(), // UUID de LL2
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    statusId: integer("status_id"),
    statusAbbrev: text("status_abbrev"), // Go, TBD, TBC, Hold, In Flight, Success, Failure, Partial Failure
    statusName: text("status_name"),
    net: tstz("net"),
    netPrecision: text("net_precision"), // SEC, MIN, HR, DAY, MON, Q1..., YEAR...
    windowStart: tstz("window_start"),
    windowEnd: tstz("window_end"),
    providerId: integer("provider_id").references(() => agencies.id),
    rocketConfigId: integer("rocket_config_id").references(() => rocketConfigs.id),
    padId: integer("pad_id").references(() => pads.id),
    locationId: integer("location_id").references(() => locations.id),
    countryCode: text("country_code"), // país de la base
    missionName: text("mission_name"),
    missionType: text("mission_type"),
    missionDescription: text("mission_description"),
    missionDescriptionEs: text("mission_description_es"),
    orbitName: text("orbit_name"),
    orbitAbbrev: text("orbit_abbrev"),
    launchDesignator: text("launch_designator"), // COSPAR yyyy-nnn → CelesTrak
    imageUrl: text("image_url"),
    thumbnailUrl: text("thumbnail_url"),
    imageCredit: text("image_credit"),
    failReason: text("fail_reason"),
    webcastLive: boolean("webcast_live"),
    probability: integer("probability"),
    detailed: boolean("detailed").default(false).notNull(), // true si viene de mode=detailed
    raw: jsonb("raw"),
    ll2LastUpdated: tstz("ll2_last_updated"),
    updatedAt: tstz("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("launches_net_idx").on(t.net),
    index("launches_status_idx").on(t.statusAbbrev),
    index("launches_provider_idx").on(t.providerId),
    index("launches_pad_idx").on(t.padId),
    index("launches_location_idx").on(t.locationId),
    index("launches_country_idx").on(t.countryCode),
    index("launches_slug_idx").on(t.slug),
  ],
);

export const launchVideos = pgTable(
  "launch_videos",
  {
    launchId: text("launch_id")
      .references(() => launches.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    title: text("title"),
    publisher: text("publisher"),
    source: text("source"),
    typeName: text("type_name"), // "Official Webcast", "Unofficial Re-stream", ...
    language: text("language"),
    featureImage: text("feature_image"),
    startTime: tstz("start_time"),
    live: boolean("live"),
    priority: integer("priority"),
  },
  (t) => [primaryKey({ columns: [t.launchId, t.url] })],
);

export const launchLinks = pgTable(
  "launch_links",
  {
    launchId: text("launch_id")
      .references(() => launches.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    title: text("title"),
    source: text("source"),
    typeName: text("type_name"),
  },
  (t) => [primaryKey({ columns: [t.launchId, t.url] })],
);

// Estado del sincronizador: cursores de backfill, última sync incremental, etc.
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: tstz("updated_at").defaultNow().notNull(),
});

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: tstz("started_at").defaultNow().notNull(),
  finishedAt: tstz("finished_at"),
  ok: boolean("ok"),
  requests: integer("requests").default(0).notNull(),
  launchesUpserted: integer("launches_upserted").default(0).notNull(),
  log: jsonb("log"),
});
