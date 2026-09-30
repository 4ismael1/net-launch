// Sincronizador LL2 → Postgres. Se ejecuta por cron (GitHub Actions) o manualmente:
//   npm run sync
// Respeta un presupuesto por hora (ventana deslizante guardada en la BD).

import { sql, eq, getTableColumns, getTableName, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "../src/lib/db";
import { LL2Client, BudgetExceededError, RateLimitedError, type Page } from "../src/lib/ll2/client";
import { normLaunch, normAgency, normPad, normLocation } from "../src/lib/ll2/normalize";

const BASE = process.env.LL2_BASE_URL ?? "https://ll.thespacedevs.com/2.3.0";
const PER_HOUR = Number(process.env.LL2_MAX_REQUESTS_PER_HOUR ?? 14);
const CATALOG_EVERY_MS = 7 * 24 * 3600_000;
const log: string[] = [];
const say = (m: string) => {
  log.push(m);
  console.log(m);
};

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
async function paged(client: LL2Client, path: string, params: Record<string, string | number>, onPage: (r: unknown[]) => Promise<void>) {
  let offset = Number(params.offset ?? 0);
  for (;;) {
    const page = await client.get<Page<unknown>>(path, { ...params, limit: 100, offset });
    await onPage(page.results);
    offset += page.results.length;
    if (!page.next || !page.results.length) return { done: true, offset };
    if (client.remaining <= 0) return { done: false, offset };
  }
}

async function main() {
  // --reset-cursors: vuelve a cargar próximos, catálogo e histórico desde cero (sobrescribe, no borra).
  if (process.argv.includes("--reset-cursors")) {
    await setState("incremental_since", "");
    await setState("catalog_at", 0);
    await setState("backfill", { offset: 0, done: false });
    say("cursores reiniciados");
  }
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

    // 4) Histórico (1957 → hoy) con el presupuesto sobrante
    const bf = await getState<{ offset: number; done: boolean }>("backfill", { offset: 0, done: false });
    if (!bf.done && client.remaining > 0) {
      let n = 0;
      const r = await paged(client, "/launches/previous/", { mode: "normal", ordering: "net", offset: bf.offset }, async (res) => {
        n += await saveLaunches(res);
      });
      await setState("backfill", r);
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

  await setState(`ll2_request_log:${new URL(BASE).host}`, [...history, ...Array(client.requests).fill(now)]);
  await db
    .update(schema.syncRuns)
    .set({ finishedAt: new Date(), ok, requests: client.requests, launchesUpserted: upserted, log })
    .where(eq(schema.syncRuns.id, run.id));

  // Revalidar la web si está desplegada
  if (process.env.SITE_URL && process.env.REVALIDATE_SECRET && upserted > 0) {
    await fetch(`${process.env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
    }).catch(() => say("no se pudo revalidar la web"));
  }
  say(`listo · ${client.requests} peticiones · ${upserted} lanzamientos`);
  process.exit(ok ? 0 : 1);
}

main();
