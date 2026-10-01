// Sincronizador LL2 → Postgres, reutilizable desde:
//   · GitHub Actions / terminal (scripts/sync.ts)       · cron diario de Vercel (/api/cron/sync)
//   · autosincronización al visitar la web si los datos tienen > 15 min (/api/live, en segundo plano)
// Respeta un presupuesto por hora (ventana deslizante en la BD) y un candado para no solaparse.
// Cada petición a LL2 se registra en la BD ANTES de hacerse: si la función muere a mitad, el presupuesto ya la cuenta.

import { sql, eq, inArray, getTableColumns, getTableName, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/lib/db";
import { LL2Client, BudgetExceededError, RateLimitedError, type Page } from "@/lib/ll2/client";
import { normLaunch, normAgency, normPad, normLocation } from "@/lib/ll2/normalize";
import { createHash, randomUUID } from "node:crypto";
import { translateBatch } from "@/lib/translate";
import { fetchSatcatSummary } from "@/lib/satcat";

const md5 = (t: string) => createHash("md5").update(t, "utf8").digest("hex");

const BASE = process.env.LL2_BASE_URL ?? "https://ll.thespacedevs.com/2.3.0";
const PER_HOUR = Number(process.env.LL2_MAX_REQUESTS_PER_HOUR ?? 14);
const CATALOG_EVERY_MS = 7 * 24 * 3600_000;
const LOG_KEY = `ll2_request_log:${new URL(BASE).host}`;

// Estado de UNA ejecución (nada global: dos llamadas en la misma instancia no se pisan el registro ni el plazo)
type Ctx = { log: string[]; say: (m: string) => void; deadline: number; catalogSaved: number; owner: string };
function newCtx(deadlineMs?: number): Ctx {
  const log: string[] = [];
  return {
    log,
    say: (m) => {
      log.push(m);
      console.log(m);
    },
    deadline: deadlineMs ? Date.now() + deadlineMs : Infinity,
    catalogSaved: 0,
    owner: randomUUID(),
  };
}

export type SyncOptions = {
  source: "cli" | "cron" | "web";
  resetCursors?: boolean;
  /** Tiempo máximo (ms) antes de dejar tareas largas (histórico, traducciones) para la próxima vez. */
  deadlineMs?: number;
  maxTranslateRequests?: number;
};
export type SyncResult = { ok: boolean; skipped?: string; requests: number; upserted: number; catalog?: number; log: string[] };

class LockLostError extends Error {}

// ---------- candado ----------
const LOCK_TTL = 15 * 60_000;
// Antigüedad del candado: admite el formato antiguo (número) y el actual ({ owner, at })
const lockAt = sql.raw(
  `CASE jsonb_typeof(sync_state.value) WHEN 'number' THEN (sync_state.value #>> '{}')::bigint WHEN 'object' THEN COALESCE((sync_state.value->>'at')::bigint, 0) ELSE 0 END`,
);
/** Candado atómico en la BD con dueño: evita dos sincronizaciones a la vez (cron + visita, etc.). */
async function acquireLock(owner: string) {
  const now = Date.now();
  const { rows } = await db.execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES ('sync_lock', ${JSON.stringify({ owner, at: now })}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()
    WHERE ${lockAt} < ${now - LOCK_TTL}
    RETURNING key`);
  return rows.length > 0;
}
/** Renueva el candado; false si ya no es nuestro (expiró y lo tomó otra ejecución). */
async function touchLock(owner: string) {
  const { rows } = await db.execute(sql`
    UPDATE sync_state SET value = jsonb_set(value, '{at}', to_jsonb(${Date.now()}::bigint)), updated_at = now()
    WHERE key = 'sync_lock' AND jsonb_typeof(value) = 'object' AND value->>'owner' = ${owner}
    RETURNING key`);
  return rows.length > 0;
}
/** Solo libera el candado propio (nunca el de otra ejecución que lo tomara tras expirar el nuestro). */
const releaseLock = (owner: string) =>
  db.execute(sql`
    UPDATE sync_state SET value = '0'::jsonb, updated_at = now()
    WHERE key = 'sync_lock' AND jsonb_typeof(value) = 'object' AND value->>'owner' = ${owner}`);

/** Añade una petición al registro de la última hora (atómico; descarta las de hace > 1 h). */
async function logRequest(ts: number) {
  await db.execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES (${LOG_KEY}, ${JSON.stringify([ts])}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET updated_at = now(), value = COALESCE((
      SELECT jsonb_agg(x) FROM jsonb_array_elements(CASE jsonb_typeof(sync_state.value) WHEN 'array' THEN sync_state.value ELSE '[]'::jsonb END) x
      WHERE jsonb_typeof(x) = 'number' AND (x #>> '{}')::numeric > ${ts - 3600_000}
    ), '[]'::jsonb) || excluded.value`);
}

/** Minutos desde el último INTENTO de sincronización (con o sin consultas). */
export async function minutesSinceLastAttempt() {
  const { rows } = await db.execute<{ m: number | null }>(sql`
    SELECT extract(epoch FROM (now() - max(updated_at))) / 60 AS m FROM sync_state WHERE key = 'autosync_attempt'`);
  return rows[0]?.m == null ? null : Number(rows[0].m);
}
export const markAttempt = () => setState("autosync_attempt", Date.now());

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

/**
 * Upsert que no borra datos ricos con datos parciales: col = COALESCE(nuevo, actual).
 * `invalidate` (traducción → original): si el original cambia, la traducción vuelve a NULL para retraducirse.
 */
async function upsertCoalesce<T extends PgTable>(table: T, rows: Record<string, unknown>[], invalidate: Record<string, string> = {}) {
  if (!rows.length) return;
  const cols = getTableColumns(table);
  const t = getTableName(table);
  const set: Record<string, SQL> = {};
  for (const [k, c] of Object.entries(cols)) {
    if (k === "id") continue;
    const src = invalidate[k] && cols[invalidate[k]]?.name;
    set[k] =
      k === "updatedAt"
        ? sql`now()`
        : src
          ? sql.raw(`CASE WHEN excluded."${src}" IS NOT NULL AND excluded."${src}" IS DISTINCT FROM "${t}"."${src}" THEN NULL ELSE "${t}"."${c.name}" END`)
          : sql.raw(`COALESCE(excluded."${c.name}", "${t}"."${c.name}")`);
  }
  for (let i = 0; i < rows.length; i += 50) {
    await db
      .insert(table)
      .values(rows.slice(i, i + 50) as never)
      .onConflictDoUpdate({ target: (cols as Record<string, never>).id, set });
  }
}

const AGENCY_I18N = { descriptionEs: "description" };

async function saveLaunches(raw: unknown[]) {
  const items = raw.map(normLaunch);
  await upsertCoalesce(schema.agencies, uniqBy(items.flatMap((i) => i.agencies), (a) => a.id), AGENCY_I18N);
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
  // Si LL2 cambia la descripción de la misión, la traducción guardada deja de valer
  set.missionDescriptionEs = sql.raw(
    `CASE WHEN excluded."mission_description" IS DISTINCT FROM "launches"."mission_description" THEN NULL ELSE "launches"."mission_description_es" END`,
  );
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

  // Videos y enlaces: se reemplazan solo cuando llega la versión detallada (una transacción por página, no 4 consultas por lanzamiento)
  const det = items.filter((it) => it.videos && it.links);
  if (det.length) {
    const ids = [...new Set(det.map((it) => it.launch.id))];
    const v = uniqBy(det.flatMap((it) => it.videos!), (x) => `${x.launchId} ${x.url}`);
    const l = uniqBy(det.flatMap((it) => it.links!), (x) => `${x.launchId} ${x.url}`);
    const ops: BatchItem<"pg">[] = [
      db.delete(schema.launchVideos).where(inArray(schema.launchVideos.launchId, ids)),
      db.delete(schema.launchLinks).where(inArray(schema.launchLinks.launchId, ids)),
    ];
    for (let i = 0; i < v.length; i += 200) ops.push(db.insert(schema.launchVideos).values(v.slice(i, i + 200)));
    for (let i = 0; i < l.length; i += 200) ops.push(db.insert(schema.launchLinks).values(l.slice(i, i + 200)));
    const [first, ...rest] = ops;
    await db.batch([first, ...rest]);
  }
  return launchRows.length;
}

// ---------- tareas ----------
async function paged(ctx: Ctx, client: LL2Client, path: string, params: Record<string, string | number>, onPage: (r: unknown[]) => Promise<void>) {
  let offset = Number(params.offset ?? 0);
  for (;;) {
    if (Date.now() > ctx.deadline) return { done: false, offset };
    const page = await client.get<Page<unknown>>(path, { ...params, limit: 100, offset });
    await onPage(page.results);
    offset += page.results.length;
    if (!page.next || !page.results.length) return { done: true, offset };
    if (client.remaining <= 0) return { done: false, offset };
  }
}

// Peticiones por hora reservadas para lo urgente (incremental de próximos lanzamientos): las tareas de fondo
// (catálogos, histórico) nunca bajan de aquí, así la web siempre puede refrescar fechas y estados.
const RESERVE = Number(process.env.LL2_RESERVE ?? 6);

const CATALOG_JOBS = [
  { kind: "programs", mode: "normal" },
  { kind: "launchers", mode: "detailed" },
  { kind: "landings", mode: "normal" },
  { kind: "spacecraft", mode: "normal" },
  { kind: "astronauts", mode: "normal" },
] as const;

/** Como paged(), pero se detiene dejando `reserve` peticiones libres. */
async function pagedUntil(ctx: Ctx, client: LL2Client, path: string, params: Record<string, string | number>, reserve: number, onPage: (r: unknown[]) => Promise<void>) {
  let offset = Number(params.offset ?? 0);
  for (;;) {
    if (Date.now() > ctx.deadline || client.remaining <= reserve) return { done: false, offset };
    const page = await client.get<Page<unknown>>(path, { ...params, limit: 100, offset });
    await onPage(page.results);
    offset += page.results.length;
    if (!page.next || !page.results.length) return { done: true, offset };
  }
}

// Quita campos que no usamos (urls de la API, licencias…) para guardar documentos ligeros
function slim(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(slim);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (k !== "url" && k !== "license" && k !== "variants" && k !== "response_mode") o[k] = slim(x);
    return o;
  }
  return v;
}

async function saveCatalog(ctx: Ctx, kind: string, res: unknown[]) {
  const rows = uniqBy((res as { id: number }[]).filter((x) => typeof x?.id === "number"), (x) => x.id).map((x) => ({ kind, id: x.id, data: slim(x), updatedAt: new Date() }));
  if (!rows.length) return 0;
  ctx.catalogSaved += rows.length;
  await db
    .insert(schema.catalog)
    .values(rows)
    .onConflictDoUpdate({ target: [schema.catalog.kind, schema.catalog.id], set: { data: sql`excluded.data`, updatedAt: sql`excluded.updated_at` } });
  return rows.length;
}

/** Borra el historial de ejecuciones de hace > 30 días (como mucho una vez al día). */
async function pruneRuns(ctx: Ctx) {
  try {
    if (Date.now() - (await getState<number>("runs_pruned_at", 0)) < 24 * 3600_000) return;
    await db.execute(sql`DELETE FROM sync_runs WHERE started_at < now() - interval '30 days'`);
    await setState("runs_pruned_at", Date.now());
  } catch (e) {
    ctx.say(`limpieza de sync_runs pausada: ${(e as Error).message}`);
  }
}

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const ctx = newCtx(opts.deadlineMs);
  if (!(await acquireLock(ctx.owner))) return { ok: true, skipped: "otra sincronización en curso", requests: 0, upserted: 0, log: ctx.log };
  try {
    return await syncInner(opts, ctx);
  } finally {
    await releaseLock(ctx.owner).catch(() => {});
  }
}

async function syncInner(opts: SyncOptions, ctx: Ctx): Promise<SyncResult> {
  const { say } = ctx;
  // resetCursors: vuelve a cargar próximos, catálogo e histórico desde cero (sobrescribe, no borra).
  if (opts.resetCursors) {
    await setState("incremental_since", "");
    await setState("catalog_at", 0);
    await setState("catalog_cursor", {});
    await setState("backfill_desc", { offset: 0, done: false });
    await setState("snapshots_at", 0);
    say("cursores reiniciados");
  }
  say(`origen: ${opts.source}`);
  const now = Date.now();
  let upserted = 0;
  await pruneRuns(ctx);

  // Ventana deslizante de 1 h con las peticiones ya registradas (incluidas las de ejecuciones que murieron a mitad).
  const logged = await getState<unknown>(LOG_KEY, []);
  const history = (Array.isArray(logged) ? logged : []).filter((t): t is number => typeof t === "number" && now - t < 3600_000);
  // Tras un 429, LL2 queda en pausa hasta la hora que indicó (o 15 min)
  const blockedUntil = await getState<number>("ll2_blocked_until", 0);
  const blocked = blockedUntil > now;
  const budget = blocked ? 0 : Math.max(0, PER_HOUR - history.length);
  // Autosincronización sin presupuesto: no hace nada (ni registro, ni traducciones, ni carga en la BD)
  if (budget === 0 && opts.source === "web") {
    return { ok: true, skipped: blocked ? "LL2 en pausa tras un 429" : "sin presupuesto esta hora", requests: 0, upserted: 0, log: ctx.log };
  }
  const [run] = await db.insert(schema.syncRuns).values({}).returning();
  const client = new LL2Client(BASE, budget, {
    deadline: ctx.deadline,
    beforeRequest: async () => {
      if (!(await touchLock(ctx.owner))) throw new LockLostError("candado perdido: otra ejecución tomó el relevo");
      await logRequest(Date.now());
    },
  });
  say(`LL2 ${BASE} · presupuesto ${budget}/${PER_HOUR}${blocked ? ` · en pausa hasta ${new Date(blockedUntil).toISOString()}` : ""}`);

  let ok = true;
  let lockLost = false;
  try {
    if (budget === 0) throw new BudgetExceededError(blocked ? "LL2 en pausa tras un 429" : "sin presupuesto esta hora");

    // 1) Carga inicial de próximos (una sola vez)
    const inc = await getState<string | null>("incremental_since", null);
    if (!inc) {
      const started = new Date().toISOString();
      const r = await paged(ctx, client, "/launches/upcoming/", { mode: "detailed" }, async (res) => {
        upserted += await saveLaunches(res);
      });
      if (r.done) await setState("incremental_since", started);
      say(`próximos: ${upserted} (completo: ${r.done})`);
    } else {
      // 2) Incremental: todo lo modificado desde la última vez (cambios de fecha/estado/resultados)
      let maxSeen = inc;
      const r = await paged(
        ctx,
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

    // 2b) Instantáneas "En el espacio" y eventos (cada 3 h, 6 peticiones). Cada una se guarda al llegar.
    const lastSnap = await getState<number>("snapshots_at", 0);
    if (now - lastSnap > 3 * 3600_000 && client.remaining >= 6 && Date.now() < ctx.deadline) {
      const evUp = await client.get<Page<unknown>>("/events/upcoming/", { limit: 100 });
      const evPrev = await client.get<Page<unknown>>("/events/previous/", { limit: 30 });
      await setState("snap_events", { upcoming: evUp.results, previous: evPrev.results, at: now });
      const astro = await client.get<Page<unknown>>("/astronauts/", { in_space: "true", limit: 100, mode: "normal" });
      const stations = await client.get<Page<unknown>>("/space_stations/", { status: 1, limit: 20, mode: "detailed" });
      const expeditions = await client.get<Page<unknown>>("/expeditions/", { is_active: "true", limit: 20, mode: "detailed" });
      await setState("snap_space", { astronauts: astro.results, stations: stations.results, expeditions: expeditions.results, at: now });
      // Últimos lanzamientos completados en modo detallado (aterrizajes, vídeos, cronología): el histórico llega en modo normal
      const prevDetailed = await client.get<Page<unknown>>("/launches/previous/", { mode: "detailed", limit: 25 });
      upserted += await saveLaunches(prevDetailed.results);
      await setState("snapshots_at", now);
      say(`instantáneas: ${evUp.results.length}+${evPrev.results.length} eventos, ${astro.results.length} astronautas, ${stations.results.length} estaciones`);
    }

    // 3) Catálogo semanal: agencias y plataformas (incluye bases sin lanzamientos recientes).
    // Por páginas con cursor y respetando la reserva; solo se da por hecho cuando ambos terminan.
    const lastCatalog = await getState<number>("catalog_at", 0);
    if (now - lastCatalog > CATALOG_EVERY_MS && client.remaining > RESERVE && Date.now() < ctx.deadline) {
      const cur = await getState<{ agencies?: number; pads?: number }>("catalog_cursor", {});
      const jobs = [
        {
          kind: "agencies" as const,
          mode: "detailed",
          save: async (res: unknown[]) =>
            upsertCoalesce(schema.agencies, uniqBy(res.map(normAgency).filter(Boolean) as Record<string, unknown>[], (a) => a.id as number), AGENCY_I18N),
        },
        {
          kind: "pads" as const,
          mode: "normal",
          save: async (res: unknown[]) => {
            const pads = res as { location?: unknown }[];
            await upsertCoalesce(schema.locations, uniqBy(pads.map((p) => normLocation(p.location)).filter(Boolean) as Record<string, unknown>[], (x) => x.id as number));
            await upsertCoalesce(schema.pads, uniqBy(pads.map(normPad).filter(Boolean) as Record<string, unknown>[], (x) => x.id as number));
          },
        },
      ];
      let complete = true;
      for (const job of jobs) {
        if (cur[job.kind] === -1) continue; // ya completo en esta vuelta
        const r = await pagedUntil(ctx, client, `/${job.kind}/`, { mode: job.mode, ordering: "id", offset: cur[job.kind] ?? 0 }, RESERVE, job.save);
        cur[job.kind] = r.done ? -1 : r.offset;
        await setState("catalog_cursor", cur);
        if (!r.done) {
          complete = false;
          break;
        }
      }
      if (complete) {
        await setState("catalog_at", now);
        await setState("catalog_cursor", {});
      }
      say(`catálogo agencias/plataformas: ${complete ? "actualizado" : `en curso (${JSON.stringify(cur)})`}`);
    }

    // 3b) Catálogos LL2 (semanal, repartido entre ejecuciones con cursor por catálogo): reutilización,
    // programas, astronautas y naves. Solo con presupuesto por encima de la reserva.
    const cat = await getState<Record<string, { offset: number; at: number }>>("catalog_jobs", {});
    for (const job of CATALOG_JOBS) {
      const st = cat[job.kind] ?? { offset: 0, at: 0 };
      if (now - st.at < CATALOG_EVERY_MS || client.remaining <= RESERVE || Date.now() > ctx.deadline) continue;
      let n = 0;
      const r = await pagedUntil(ctx, client, `/${job.kind}/`, { mode: job.mode, ordering: "id", offset: st.offset }, RESERVE, async (res) => {
        n += await saveCatalog(ctx, job.kind, res);
      });
      cat[job.kind] = r.done ? { offset: 0, at: now } : { offset: r.offset, at: st.at };
      await setState("catalog_jobs", cat);
      say(`catálogo ${job.kind}: +${n} (offset ${r.offset}, completo: ${r.done})`);
    }

    // 4) Histórico (hoy → 1957) con el presupuesto sobrante. Descendente: primero lo reciente.
    // Si entran lanzamientos nuevos en "previous" el offset se desplaza hacia atrás → solo repite, nunca salta.
    const bf = await getState<{ offset: number; done: boolean }>("backfill_desc", { offset: 0, done: false });
    if (!bf.done && client.remaining > RESERVE && Date.now() < ctx.deadline) {
      let n = 0;
      const r = await pagedUntil(ctx, client, "/launches/previous/", { mode: "normal", ordering: "-net", offset: bf.offset }, RESERVE, async (res) => {
        n += await saveLaunches(res);
      });
      await setState("backfill_desc", r);
      upserted += n;
      say(`histórico: +${n} (offset ${r.offset}, completo: ${r.done})`);
    }
  } catch (e) {
    if (e instanceof BudgetExceededError) say(`fin por presupuesto: ${e.message}`);
    else if (e instanceof RateLimitedError) {
      // Un 429 no es una sincronización válida: no cuenta como "última actualización" y pausa LL2
      ok = false;
      const wait = Math.min(Math.max(e.retryAfterSec ?? 900, 60), 3600);
      await setState("ll2_blocked_until", Date.now() + wait * 1000).catch(() => {});
      say(`${e.message} · LL2 en pausa ${Math.round(wait / 60)} min`);
    } else if (e instanceof LockLostError) {
      ok = false;
      lockLost = true;
      say(e.message);
    } else {
      ok = false;
      say(`ERROR: ${(e as Error).stack ?? e}`);
    }
  }

  // 4b) Población orbital (CelesTrak SATCAT, semanal; no consume presupuesto de LL2)
  if (!lockLost && Date.now() < ctx.deadline - 15_000 && now - (await getState<number>("satcat_at", 0)) > CATALOG_EVERY_MS) {
    try {
      const sum = await fetchSatcatSummary(Math.min(30_000, ctx.deadline - Date.now()));
      await setState("satcat", sum);
      await setState("satcat_at", now);
      say(`SATCAT: ${sum.total} objetos, ${sum.onOrbit} en órbita`);
    } catch (e) {
      say(`SATCAT pausado: ${(e as Error).message}`);
    }
  }

  // 5) Traducciones (Gemini): textos únicos, prioridad a próximos y recientes. Nunca más allá del plazo.
  if (!lockLost && process.env.GEMINI_API_KEY && Date.now() < ctx.deadline) {
    try {
      const n = await translatePending(ctx, opts.maxTranslateRequests ?? Number(process.env.GEMINI_MAX_REQUESTS ?? 6));
      if (n) say(`traducidos: ${n} textos`);
    } catch (e) {
      say(`traducción pausada: ${(e as Error).message}`);
    }
  }

  await db
    .update(schema.syncRuns)
    .set({ finishedAt: new Date(), ok, requests: client.requests, launchesUpserted: upserted, log: ctx.log })
    .where(eq(schema.syncRuns.id, run.id));

  // Revalidar la web si está desplegada
  if (opts.source === "cli" && process.env.SITE_URL && process.env.REVALIDATE_SECRET && (upserted > 0 || ctx.catalogSaved > 0)) {
    await fetch(`${process.env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => say("no se pudo revalidar la web"));
  }
  say(`listo · ${client.requests} peticiones · ${upserted} lanzamientos`);
  return { ok, requests: client.requests, upserted, catalog: ctx.catalogSaved, log: ctx.log };
}

// Orden: misiones cercanas (±90 días) → organizaciones → textos de catálogo (en el espacio ahora, eventos,
// cohetes, programas, bases, biografías, naves…) → resto del histórico de misiones.
async function translatePending(ctx: Ctx, maxRequests: number) {
  let done = 0;
  // Cada llamada a Gemini se corta al llegar al plazo de la ejecución (máx. 60 s)
  const timeout = () => Math.min(60_000, ctx.deadline - Date.now());
  const missions = async (near: boolean) => {
    const { rows } = await db.execute<{ d: string }>(sql`
      SELECT mission_description AS d FROM launches
      WHERE mission_description IS NOT NULL AND mission_description_es IS NULL
        ${near ? sql`AND net BETWEEN now() - interval '90 days' AND now() + interval '90 days'` : sql``}
      GROUP BY mission_description
      ORDER BY min(abs(extract(epoch FROM (net - now())))) ASC LIMIT 25`);
    const texts = rows.map((x) => x.d);
    if (!texts.length) return false;
    const out = await translateBatch(texts, timeout());
    if (!out) return true; // lote inválido: se reintenta en la próxima vuelta
    for (let i = 0; i < texts.length; i++) {
      await db.update(schema.launches).set({ missionDescriptionEs: out[i] }).where(eq(schema.launches.missionDescription, texts[i]));
    }
    done += texts.length;
    return true;
  };
  const agencies = async () => {
    const { rows: ag } = await db.execute<{ id: number; d: string }>(sql`
      SELECT id, description AS d FROM agencies WHERE description IS NOT NULL AND description_es IS NULL
      ORDER BY total_launch_count DESC NULLS LAST LIMIT 15`);
    if (!ag.length) return false;
    const out = await translateBatch(ag.map((x) => x.d), timeout());
    if (out) for (let i = 0; i < ag.length; i++) await db.update(schema.agencies).set({ descriptionEs: out[i] }).where(eq(schema.agencies.id, ag[i].id));
    if (out) done += ag.length;
    return true;
  };
  const generic = async () => {
    const { rows } = await db.execute<{ t: string }>(sql`
      WITH src(t, pri) AS (
        SELECT jsonb_array_elements(value->'astronauts')->>'bio', 0 FROM sync_state WHERE key = 'snap_space'
        UNION ALL SELECT jsonb_array_elements(value->'stations')->>'description', 0 FROM sync_state WHERE key = 'snap_space'
        UNION ALL SELECT jsonb_array_elements(value->'upcoming')->>'description', 1 FROM sync_state WHERE key = 'snap_events'
        UNION ALL SELECT jsonb_array_elements(value->'previous')->>'description', 2 FROM sync_state WHERE key = 'snap_events'
        UNION ALL SELECT description, 3 FROM rocket_configs
        UNION ALL SELECT data->>'description', 3 FROM catalog WHERE kind = 'programs'
        UNION ALL SELECT description, 4 FROM locations
        UNION ALL SELECT data#>>'{landing_location,description}', 4 FROM catalog WHERE kind = 'landings'
        UNION ALL SELECT data#>>'{type,description}', 4 FROM catalog WHERE kind = 'landings'
        UNION ALL SELECT data->>'description', 5 FROM catalog WHERE kind = 'landings'
        UNION ALL SELECT data->>'bio', 6 FROM catalog WHERE kind = 'astronauts'
        UNION ALL SELECT data->>'description', 7 FROM catalog WHERE kind = 'spacecraft'
        UNION ALL SELECT data->>'details', 8 FROM catalog WHERE kind = 'launchers'
      )
      SELECT t FROM src
      WHERE t IS NOT NULL AND length(t) > 12 AND NOT EXISTS (SELECT 1 FROM translations tr WHERE tr.hash = md5(src.t))
      GROUP BY t ORDER BY min(pri), t LIMIT 25`);
    const texts = rows.map((x) => x.t);
    if (!texts.length) return false;
    const out = await translateBatch(texts, timeout());
    if (!out) return true;
    await db
      .insert(schema.translations)
      .values(texts.map((t, i) => ({ hash: md5(t), src: t, es: out[i] })))
      .onConflictDoNothing();
    done += texts.length;
    return true;
  };
  // Solo si queda margen razonable (10 s) antes del plazo
  for (let r = 0; r < maxRequests && ctx.deadline - Date.now() > 10_000; r++) {
    if (await missions(true)) continue;
    if (await agencies()) continue;
    if (await generic()) continue;
    if (await missions(false)) continue;
    break;
  }
  return done;
}
