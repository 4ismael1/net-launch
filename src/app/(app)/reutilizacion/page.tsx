import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Check, X, Recycle, Timer } from "lucide-react";
import { getReuse, launcherStatus } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty } from "@/components/ui/Card";
import { When } from "@/components/ui/When";
import { Ticker } from "@/components/ui/Ticker";
import { WorldDots } from "@/components/map/WorldDots";

export const metadata: Metadata = {
  title: "Reutilización y aterrizajes",
  description: "El próximo aterrizaje de un propulsor, los más veteranos, las zonas de recuperación y los resultados recientes, con datos de Launch Library 2.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Reutilización y aterrizajes"
        description="Cohetes que vuelven y vuelan otra vez: el próximo aterrizaje, los propulsores más veteranos, las zonas de recuperación y los resultados recientes. Datos de Launch Library 2." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-64 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-96 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString("es")} %` : "—");
const days = (s: number | null) => (s == null ? "—" : s < 2 * 86400 ? `${Math.round(s / 3600)} h` : `${(Math.round((s / 86400) * 10) / 10).toLocaleString("es")} días`);
const mission = (n: string) => n.split("|").pop()?.trim() ?? n;

/** Un punto por vuelo; el último (este) resaltado. */
function FlightDots({ n, highlightLast, max = 40 }: { n: number; highlightLast?: boolean; max?: number }) {
  const shown = Math.min(n, max);
  return (
    <span className="flex flex-wrap gap-[3px]" aria-label={`${n} vuelos`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={clsx("size-2 rounded-full", highlightLast && i === shown - 1 ? "bg-accent ring-2 ring-accent/30" : "bg-fg-muted/70")} />
      ))}
      {n > max && <span className="num text-[10px] text-fg-dim">+{n - max}</span>}
    </span>
  );
}

function Outcome({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-xs text-fg-dim">Pendiente</span>;
  return ok ? <span className="inline-flex items-center gap-1 text-xs text-fg"><Check className="size-3.5 text-success" /> Aterrizó</span>
    : <span className="inline-flex items-center gap-1 text-xs text-failure"><X className="size-3.5" /> Fallido</span>;
}

async function Content() {
  const d = await getReuse();
  const t = d.totals;
  const next = d.upcoming[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Protagonista: próximo aterrizaje + cifras de la flota */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="relative border-b border-line p-5 md:p-7 lg:border-r lg:border-b-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,#ff5b1f14,transparent_55%)]" />
            {next ? (
              <div className="relative">
                <p className="label flex items-center gap-1.5 !text-accent"><Recycle className="size-3.5" /> Próximo aterrizaje</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl"><span className="num">{next.serial ?? "Propulsor por confirmar"}</span></h2>
                <p className="mt-1 text-sm text-fg-muted">
                  <Link href={`/lanzamientos/${next.slug}`} className="text-fg hover:underline">{mission(next.name)}</Link> · {next.type}{next.whereName && ` en ${next.whereName}`}
                </p>
                <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
                  <Ticker at={next.net} precision={next.precision} className="text-3xl md:text-4xl" />
                  {next.flight && (
                    <div>
                      <p className="label mb-1.5">{next.flight}.º vuelo de este propulsor</p>
                      <FlightDots n={next.flight} highlightLast />
                    </div>
                  )}
                </div>
                {next.turnaround && <p className="mt-4 text-xs text-fg-dim"><Timer className="mr-1 inline size-3.5" />Vuelve a volar {days(next.turnaround)} después de su vuelo anterior.</p>}
              </div>
            ) : <p className="text-sm text-fg-dim">Sin aterrizajes previstos en los próximos lanzamientos.</p>}
          </div>
          <dl className="grid grid-cols-2 gap-px bg-line">
            <div className="bg-surface p-5"><dt className="label">Propulsores</dt><dd className="num mt-2 text-3xl">{t.boosters || "—"}</dd><dd className="mt-1 text-xs text-fg-dim">{t.proven ? `${t.proven} reutilizados` : " "}</dd></div>
            <div className="bg-surface p-5"><dt className="label">Aterrizajes</dt><dd className="num mt-2 text-3xl">{t.landings ? t.landings.toLocaleString("es") : "—"}</dd><dd className="mt-1 text-xs text-fg-dim">{t.attempts ? `${pct(t.landings, t.attempts)} de éxito` : " "}</dd></div>
            <div className="bg-surface p-5"><dt className="label">Récord</dt><dd className="num mt-2 text-3xl">{t.maxFlights || "—"}</dd><dd className="mt-1 text-xs text-fg-dim">{t.maxSerial ? `vuelos · ${t.maxSerial}` : " "}</dd></div>
            <div className="bg-surface p-5"><dt className="label">Más rápida</dt><dd className="num mt-2 text-3xl">{t.fastest ? days(t.fastest.fastest) : "—"}</dd><dd className="mt-1 text-xs text-fg-dim">{t.fastest ? `entre vuelos · ${t.fastest.serial}` : " "}</dd></div>
          </dl>
        </div>
      </section>

      {!d.hasCatalog && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">El catálogo de propulsores y zonas de aterrizaje se está descargando de LL2 poco a poco (respetando su límite de peticiones).</p>
      )}

      {/* Zonas de recuperación */}
      {d.zones.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-line bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="label !text-fg-muted">Dónde aterrizan</h2>
            <span className="text-xs text-fg-dim">Tamaño = intentos · en naranja, zonas usadas en próximos vuelos</span>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="border-b border-line bg-[#0e0e0d] lg:border-r lg:border-b-0">
              <WorldDots dots={d.zones.filter((z) => z.lat != null && z.lng != null).map((z) => ({
                lat: z.lat!, lon: z.lng!, r: 6 + Math.sqrt(z.attempts) * 2.2, label: z.abbrev ?? z.name,
                title: `${z.name}: ${z.ok}/${z.attempts} aterrizajes`, accent: d.upcoming.some((u) => u.where === z.abbrev),
              }))} />
            </div>
            <ul className="grid content-start gap-2.5 p-4">
              {d.zones.slice(0, 9).map((z) => (
                <li key={z.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                  <span className="truncate"><span className="font-medium">{z.abbrev ?? z.name}</span> <span className="text-xs text-fg-dim">{z.abbrev ? z.name : ""}</span></span>
                  <span className="num text-xs text-fg-muted">{z.ok}/{z.attempts}</span>
                  <span className="col-span-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                    <span className="h-full rounded-l-full bg-fg-muted/70" style={{ width: `${(z.ok / z.attempts) * 100}%` }} />
                    {z.attempts > z.ok && <span className="h-full rounded-r-full bg-failure" style={{ width: `${((z.attempts - z.ok) / z.attempts) * 100}%` }} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Los veteranos */}
      {d.leaders.length > 0 && (
        <section>
          <h2 className="label mb-3 !text-fg-muted">Los propulsores más veteranos</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {d.leaders.slice(0, 10).map((b, i) => (
              <li key={b.id} className={clsx("flex flex-col rounded-lg border bg-surface p-4", i === 0 ? "border-accent/50" : "border-line")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="num text-xl font-semibold">{b.serial}</span>
                  <span className="num text-xs text-fg-dim">#{i + 1}</span>
                </div>
                <p className="truncate text-xs text-fg-dim">{b.config ?? "—"} · {launcherStatus(b.status)}</p>
                <div className="mt-3"><FlightDots n={b.flights} /></div>
                <p className="mt-auto pt-3 text-xs text-fg-muted"><span className="num text-fg">{b.flights}</span> vuelos · <span className="num text-fg">{b.landings}</span>/{b.attempts} aterrizajes</p>
                {b.last && <p className="text-[11px] text-fg-dim">Último: <When at={b.last} withTime={false} /></p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Próximos aterrizajes" />
          {d.upcoming.length ? (
            <ul className="divide-y divide-line">
              {d.upcoming.map((r) => (
                <li key={r.slug + r.serial}>
                  <Link href={`/lanzamientos/${r.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border border-line-strong bg-surface-2">
                      <Recycle className="size-3.5 text-accent" />
                      <span className="num mt-0.5 text-[10px] text-fg-muted">{r.flight ?? "—"}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm"><span className="num font-medium">{r.serial ?? "Propulsor por confirmar"}</span> <span className="text-fg-muted">· {mission(r.name)}</span></p>
                      <p className="truncate text-xs text-fg-dim">{r.type}{r.where && ` en ${r.where}`}</p>
                    </div>
                    <When at={r.net} className="shrink-0 text-right text-xs text-fg-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Sin aterrizajes previstos.</Empty>}
        </Card>
        <Card>
          <CardHeader title="Aterrizajes recientes" />
          {d.recent.length ? (
            <ul className="divide-y divide-line">
              {d.recent.map((r) => (
                <li key={r.slug + r.serial}>
                  <Link href={`/lanzamientos/${r.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm"><span className="num font-medium">{r.serial ?? "Propulsor"}</span> <span className="text-fg-muted">· {mission(r.name)}</span></p>
                      <p className="truncate text-xs text-fg-dim">{r.type}{r.where && ` · ${r.where}`}{r.flight ? ` · ${r.flight}.º vuelo` : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5"><Outcome ok={r.success} /><When at={r.net} withTime={false} className="text-[11px] text-fg-dim" /></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Los resultados recientes llegarán con la próxima sincronización detallada.</Empty>}
        </Card>
      </div>

      {d.fleet.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Flota por vehículo" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="label text-left"><th className="px-4 py-2 font-normal">Vehículo</th><th className="px-2 py-2 text-right font-normal">Propulsores</th><th className="px-2 py-2 text-right font-normal">Activos</th><th className="px-2 py-2 text-right font-normal">Vuelos</th><th className="px-2 py-2 text-right font-normal">Máx.</th><th className="px-4 py-2 text-right font-normal">Aterrizajes</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.fleet.map((f) => (
                    <tr key={f.config} className="transition-colors hover:bg-surface-2">
                      <td className="max-w-48 truncate px-4 py-2">{f.config}</td>
                      <td className="num px-2 py-2 text-right">{f.boosters}</td>
                      <td className="num px-2 py-2 text-right text-fg-muted">{f.active}</td>
                      <td className="num px-2 py-2 text-right">{f.flights}</td>
                      <td className="num px-2 py-2 text-right text-fg-muted">{f.maxFlights}</td>
                      <td className="num px-4 py-2 text-right">{f.attempts ? pct(f.landings, f.attempts) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid content-start gap-4">
            {d.fastest.length > 0 && (
              <Card>
                <CardHeader title="Reutilización más rápida" meta="Tiempo entre dos vuelos" />
                <ul className="divide-y divide-line text-sm">
                  {d.fastest.map((b) => <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span><span className="num font-medium">{b.serial}</span> <span className="text-xs text-fg-dim">{b.config}</span></span><span className="num">{days(b.fastest)}</span></li>)}
                </ul>
              </Card>
            )}
            {d.types.length > 0 && (
              <Card>
                <CardHeader title="Cómo se recuperan" />
                <ul className="divide-y divide-line text-sm">
                  {d.types.map((x) => <li key={x.type} className="flex items-center justify-between gap-3 px-4 py-2.5"><span>{x.type}</span><span className="text-xs text-fg-muted"><span className="num text-sm text-fg">{x.n}</span> · {pct(x.ok, x.n)} éxito</span></li>)}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
