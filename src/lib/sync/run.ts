// Sincronizador LL2 → Postgres, reutilizable desde:
//   · GitHub Actions / terminal (scripts/sync.ts)       · cron diario de Vercel (/api/cron/sync)
//   · autosincronización al visitar la web si los datos tienen > 15 min (/api/live, en segundo plano)
// Respeta un presupuesto por hora (ventana deslizante en la BD) y un candado para no solaparse.

import { sql, eq, getTableColumns, getTableName, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/lib/db";
import { LL2Client, BudgetExceededError, RateLimitedError, type Page } from "@/lib/ll2/client";
import { normLaunch, normAgency, normPad, normLocation } from "@/lib/ll2/normalize";
import { translateBatch } from "@/lib/translate";

const BASE = process.env.LL2_BASE_URL ?? "https://ll.thespacedevs.com/2.3.0";
const PER_HOUR = Number(process.env.LL2_MAX_REQUESTS_PER_HOUR ?? 14);
const CATALOG_EVERY_MS = 7 * 24 * 3600_000;
let log: string[] = [];
const say = (m: string) => {
  log.push(m);
  console.log(m);
};

export type SyncOptions = {
  source: "cli" | "cron" | "web";
  resetCursors?: boolean;
  /** Tiempo máximo (ms) antes de dejar tareas largas (histórico, traducciones) para la próxima vez. */
  deadlineMs?: number;
  maxTranslateRequests?: number;
};
export type SyncResult = { ok: boolean; skipped?: string; requests: number; upserted: number; log: string[] };

const LOCK_TTL = 10 * 60_000;
/** Candado atómico en la BD: evita dos sincronizaciones a la vez (cron + visita, etc.). */
async function acquireLock() {
  const now = Date.now();
  const { rows } = await db.execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES ('sync_lock', ${JSON.stringify(now)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()
    WHERE (sync_state.value #>> '{}')::bigint < ${now - LOCK_TTL}
    RETURNING key`);
  return rows.length > 0;
}
const releaseLock = () => setState("sync_lock", 0);

/** Minutos desde la última sincronización que llegó a consultar LL2 (null si nunca). */
export async function minutesSinceLastSync() {
  const { rows } = await db.execute<{ m: number | null }>(sql`
    SELECT extract(epoch FROM (now() - max(finished_at))) / 60 AS m FROM sync_runs WHERE ok AND requests > 0`);
  return rows[0]?.m == null ? null : Number(rows[0].m);
}

// ---------- estado ----------
async function getState<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(schema.syncState).where(eq(schema.syncState.key, key));
  return (row?.value as T) ?? fallback;
}
async function setState(key: string, value: unknown) {
  await db
    .insert(schema.syncState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.syncState.key, set: { value, updatedAt: new Date() } });
}

// ---------- upserts ----------
function uniqBy<T>(rows: T[], key: (r: T) => string | number) {
  return [...new Map(rows.map((r) => [key(r), r])).values()];
}

/** Upsert que no borra datos ricos con datos parciales: col = COALESCE(nuevo, actual). */
async function upsertCoalesce<T extends PgTable>(table: T, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = getTableColumns(table);
  const t = getTableName(table);
  const set: Record<string, SQL> = {};
  for (const [k, c] of Object.entries(cols)) {
    if (k === "id") continue;
    set[k] = k === "updatedAt" ? sql`now()` : sql.raw(`COALESCE(excluded."${c.name}", "${t}"."${c.name}")`);
  }
  for (let i = 0; i < rows.length; i += 50) {
    await db
      .insert(table)
      .values(rows.slice(i, i + 50) as never)
      .onConflictDoUpdate({ target: (cols as Record<string, never>).id, set });
  }
}

async function saveLaunches(raw: unknown[]) {
  const items = raw.map(normLaunch);
  await upsertCoalesce(schema.agencies, uniqBy(items.flatMap((i) => i.agencies), (a) => a.id));
  await upsertCoalesce(schema.locations, uniqBy(items.flatMap((i) => (i.location ? [i.location] : [])), (x) => x.id));
  await upsertCoalesce(schema.pads, uniqBy(items.flatMap((i) => (i.pad ? [i.pad] : [])), (x) => x.id));
  await upsertCoalesce(schema.rocketConfigs, uniqBy(items.flatMap((i) => (i.rocketConfig ? [i.rocketConfig] : [])), (x) => x.id));

  const launchRows = uniqBy(items.map((i) => i.launch), (l) => l.id);
  const cols = getTableColumns(schema.launches);
  const set: Record<string, SQL> = {};
  for (const [k, c] of Object.entries(cols)) {
    if (k === "id" || k === "missionDescriptionEs") continue;
    set[k] = k === "updatedAt" ? sql`now()` : sql.raw(`excluded."${c.name}"`);
  }
  for (let i = 0; i < launchRows.length; i += 25) {
    await db
      .insert(schema.launches)
      .values(launchRows.slice(i, i + 25))
      .onConflictDoUpdate({
        target: schema.launches.id,
        set,
        // No pisar una versión "detailed" con una "normal" de la misma fecha, ni una más nueva con una vieja.
        setWhere: sql`excluded.ll2_last_updated >= launches.ll2_last_updated AND (excluded.detailed OR NOT launches.detailed)`,
      });
  }

  // Videos y enlaces: se reemplazan solo cuando llega la versión detallada.
  for (const it of items) {
    if (!it.videos || !it.links) continue;
    await db.delete(schema.launchVideos).where(eq(schema.launchVideos.launchId, it.launch.id));
    await db.delete(schema.launchLinks).where(eq(schema.launchLinks.launchId, it.launch.id));
    const v = uniqBy(it.videos, (x) => x.url);
    const l = uniqBy(it.links, (x) => x.url);
    if (v.length) await db.insert(schema.launchVideos).values(v);
    if (l.length) await db.insert(schema.launchLinks).values(l);
  }
  return launchRows.length;
}

// ---------- tareas ----------
let deadline = Infinity;
async function paged(client: LL2Client, path: string, params: Record<string, string | number>, onPage: (r: unknown[]) => Promise<void>) {
  let offset = Number(params.offset ?? 0);
  for (;;) {
    if (Date.now() > deadline) return { done: false, offset, count: undefined as number | undefined };
    const page = await client.get<Page<unknown>>(path, { ...params, limit: 100, offset });
    await onPage(page.results);
    offset += page.results.length;
    if (!page.next || !page.results.length) return { done: true, offset };
    if (client.remaining <= 0) return { done: false, offset };
  }
}

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  log = [];
  const started = Date.now();
  deadline = opts.deadlineMs ? started + opts.deadlineMs : Infinity;
  if (!(await acquireLock())) return { ok: true, skipped: "otra sincronización en curso", requests: 0, upserted: 0, log };
  try {
    return await syncInner(opts);
  } finally {
    await releaseLock().catch(() => {});
  }
}

async function syncInner(opts: SyncOptions): Promise<SyncResult> {
  // resetCursors: vuelve a cargar próximos, catálogo e histórico desde cero (sobrescribe, no borra).
  if (opts.resetCursors) {
    await setState("incremental_since", "");
    await setState("catalog_at", 0);
    await setState("backfill_desc", { offset: 0, done: false });
    await setState("snapshots_at", 0);
    say("cursores reiniciados");
  }
  say(`origen: ${opts.source}`);
  const [run] = await db.insert(schema.syncRuns).values({}).returning();
  const now = Date.now();
  let upserted = 0;

  // Ventana deslizante de 1 h con las peticiones de ejecuciones anteriores.
  const history = (await getState<number[]>(`ll2_request_log:${new URL(BASE).host}`, [])).filter((t) => now - t < 3600_000);
  const budget = Math.max(0, PER_HOUR - history.length);
  const client = new LL2Client(BASE, budget);
  say(`LL2 ${BASE} · presupuesto ${budget}/${PER_HOUR}`);

  let ok = true;
  try {
    if (budget === 0) throw new BudgetExceededError("sin presupuesto esta hora");

    // 1) Carga inicial de próximos (una sola vez)
    const inc = await getState<string | null>("incremental_since", null);
    if (!inc) {
      const started = new Date().toISOString();
      const r = await paged(client, "/launches/upcoming/", { mode: "detailed" }, async (res) => {
        upserted += await saveLaunches(res);
      });
      if (r.done) await setState("incremental_since", started);
      say(`próximos: ${upserted} (completo: ${r.done})`);
    } else {
      // 2) Incremental: todo lo modificado desde la última vez (cambios de fecha/estado/resultados)
      let maxSeen = inc;
      const r = await paged(
        client,
        "/launches/",
        { mode: "detailed", last_updated__gte: inc, ordering: "last_updated" },
        async (res) => {
          upserted += await saveLaunches(res);
          for (const l of res as { last_updated: string }[]) if (l.last_updated > maxSeen) maxSeen = l.last_updated;
        },
      );
      await setState("incremental_since", r.done ? new Date(now - 60_000).toISOString() : maxSeen);
      say(`incremental: ${upserted} (completo: ${r.done})`);
    }

    // 2b) Instantáneas "En el espacio" y eventos (cada 3 h, 4 peticiones)
    const lastSnap = await getState<number>("snapshots_at", 0);
    if (now - lastSnap > 3 * 3600_000 && client.remaining >= 5) {
      const [evUp, evPrev, astro, stations, expeditions] = [
        await client.get<Page<unknown>>("/events/upcoming/", { limit: 100 }),
        await client.get<Page<unknown>>("/events/previous/", { limit: 30 }),
        await client.get<Page<unknown>>("/astronauts/", { in_space: "true", limit: 100, mode: "normal" }),
        await client.get<Page<unknown>>("/space_stations/", { status: 1, limit: 20, mode: "detailed" }),
        await client.get<Page<unknown>>("/expeditions/", { is_active: "true", limit: 20, mode: "detailed" }),
      ];
      await setState("snap_events", { upcoming: evUp.results, previous: evPrev.results, at: now });
      await setState("snap_space", { astronauts: astro.results, stations: stations.results, expeditions: expeditions.results, at: now });
      await setState("snapshots_at", now);
      say(`instantáneas: ${evUp.results.length}+${evPrev.results.length} eventos, ${astro.results.length} astronautas, ${stations.results.length} estaciones`);
    }

    // 3) Catálogo semanal: agencias y plataformas (incluye bases sin lanzamientos recientes)
    const lastCatalog = await getState<number>("catalog_at", 0);
    if (now - lastCatalog > CATALOG_EVERY_MS && client.remaining >= 8) {
      await paged(client, "/agencies/", { mode: "detailed" }, async (res) => {
        await upsertCoalesce(schema.agencies, uniqBy(res.map(normAgency).filter(Boolean) as Record<string, unknown>[], (a) => a.id as number));
      });
      await paged(client, "/pads/", { mode: "normal" }, async (res) => {
        const pads = res as { location?: unknown }[];
        await upsertCoalesce(schema.locations, uniqBy(pads.map((p) => normLocation(p.location)).filter(Boolean) as Record<string, unknown>[], (x) => x.id as number));
        await upsertCoalesce(schema.pads, uniqBy(pads.map(normPad).filter(Boolean) as Record<string, unknown>[], (x) => x.id as number));
      });
      await setState("catalog_at", now);
      say("catálogo actualizado");
    }

    // 4) Histórico (hoy → 1957) con el presupuesto sobrante. Descendente: primero lo reciente.
    // Si entran lanzamientos nuevos en "previous" el offset se desplaza hacia atrás → solo repite, nunca salta.
    const bf = await getState<{ offset: number; done: boolean }>("backfill_desc", { offset: 0, done: false });
    if (!bf.done && client.remaining > 0 && Date.now() < deadline) {
      let n = 0;
      const r = await paged(client, "/launches/previous/", { mode: "normal", ordering: "-net", offset: bf.offset }, async (res) => {
        n += await saveLaunches(res);
      });
      await setState("backfill_desc", r);
      upserted += n;
      say(`histórico: +${n} (offset ${r.offset}, completo: ${r.done})`);
    }
  } catch (e) {
    if (e instanceof BudgetExceededError) say(`fin por presupuesto: ${e.message}`);
    else if (e instanceof RateLimitedError) say(e.message);
    else {
      ok = false;
      say(`ERROR: ${(e as Error).stack ?? e}`);
    }
  }

  // 5) Traducciones (Gemini): textos únicos, prioridad a próximos y recientes
  if (process.env.GEMINI_API_KEY && Date.now() < deadline) {
    try {
      const n = await translatePending(opts.maxTranslateRequests ?? Number(process.env.GEMINI_MAX_REQUESTS ?? 6));
      if (n) say(`traducidos: ${n} textos`);
    } catch (e) {
      say(`traducción pausada: ${(e as Error).message}`);
    }
  }

  await setState(`ll2_request_log:${new URL(BASE).host}`, [...history, ...Array(client.requests).fill(now)]);
  await db
    .update(schema.syncRuns)
    .set({ finishedAt: new Date(), ok, requests: client.requests, launchesUpserted: upserted, log })
    .where(eq(schema.syncRuns.id, run.id));

  // Revalidar la web si está desplegada
  if (opts.source === "cli" && process.env.SITE_URL && process.env.REVALIDATE_SECRET && upserted > 0) {
    await fetch(`${process.env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
    }).catch(() => say("no se pudo revalidar la web"));
  }
  say(`listo · ${client.requests} peticiones · ${upserted} lanzamientos`);
  return { ok, requests: client.requests, upserted, log };
}

async function translatePending(maxRequests: number) {
  let done = 0;
  for (let r = 0; r < maxRequests && Date.now() < deadline; r++) {
    const { rows } = await db.execute<{ d: string }>(sql`
      SELECT mission_description AS d FROM launches
      WHERE mission_description IS NOT NULL AND mission_description_es IS NULL
      GROUP BY mission_description
      ORDER BY min(abs(extract(epoch FROM (net - now())))) ASC LIMIT 25`);
    const texts = rows.map((x) => x.d);
    if (!texts.length) {
      // Luego, descripciones de organizaciones
      const { rows: ag } = await db.execute<{ id: number; d: string }>(sql`
        SELECT id, description AS d FROM agencies WHERE description IS NOT NULL AND description_es IS NULL
        ORDER BY total_launch_count DESC NULLS LAST LIMIT 15`);
      if (!ag.length) break;
      const out = await translateBatch(ag.map((x) => x.d));
      if (!out) break;
      for (let i = 0; i < ag.length; i++) await db.update(schema.agencies).set({ descriptionEs: out[i] }).where(eq(schema.agencies.id, ag[i].id));
      done += ag.length;
      continue;
    }
    const out = await translateBatch(texts);
    if (!out) break;
    for (let i = 0; i < texts.length; i++) {
      await db.update(schema.launches).set({ missionDescriptionEs: out[i] }).where(eq(schema.launches.missionDescription, texts[i]));
    }
    done += texts.length;
  }
  return done;
}

