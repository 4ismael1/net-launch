import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Recycle } from "lucide-react";
import { getReuse, launcherStatus } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { When } from "@/components/ui/When";

export const metadata: Metadata = { title: "Reutilización y aterrizajes" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Reutilización y aterrizajes"
        description="Propulsores que vuelven a volar: próximos aterrizajes, resultados recientes, récords de la flota y zonas de recuperación. Datos de Launch Library 2." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-96 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString("es")} %` : "—");
const days = (s: number | null) => (s == null ? "—" : s < 2 * 86400 ? `${Math.round(s / 3600)} h` : `${(Math.round((s / 86400) * 10) / 10).toLocaleString("es")} días`);
const ord = (n: number | null) => (n ? `${n}.º vuelo` : "");

function Outcome({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-xs text-fg-dim">Pendiente</span>;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-fg"><Check className="size-3.5 text-success" /> Aterrizó</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-failure"><X className="size-3.5" /> Fallido</span>
  );
}

async function Content() {
  const d = await getReuse();
  const t = d.totals;
  const maxF = d.leaders[0]?.flights || 1;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Propulsores con vuelos" value={t.boosters ? t.boosters.toLocaleString("es") : "—"} hint={t.proven ? `${t.proven} han volado más de una vez` : undefined} />
        <Kpi label="Aterrizajes exitosos" value={t.landings ? t.landings.toLocaleString("es") : "—"} hint={t.attempts ? `${pct(t.landings, t.attempts)} de ${t.attempts.toLocaleString("es")} intentos` : undefined} />
        <Kpi label="Récord de vuelos" value={t.maxFlights || "—"} hint={t.maxSerial ? `Propulsor ${t.maxSerial}` : undefined} />
        <Kpi label="Reutilización más rápida" value={t.fastest ? days(t.fastest.fastest) : "—"} hint={t.fastest ? `${t.fastest.serial} · entre dos vuelos` : undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Próximos aterrizajes" meta="Propulsor · zona prevista" />
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
                      <p className="truncate text-sm"><span className="num font-medium">{r.serial ?? "Propulsor"}</span> <span className="text-fg-muted">· {r.name.split("|").pop()?.trim()}</span></p>
                      <p className="truncate text-xs text-fg-dim">{r.type}{r.where && ` en ${r.where}`} · {ord(r.flight)}</p>
                    </div>
                    <When at={r.net} className="shrink-0 text-right text-xs text-fg-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Sin aterrizajes previstos en los próximos lanzamientos.</Empty>}
        </Card>

        <Card>
          <CardHeader title="Aterrizajes recientes" />
          {d.recent.length ? (
            <ul className="divide-y divide-line">
              {d.recent.map((r) => (
                <li key={r.slug + r.serial}>
                  <Link href={`/lanzamientos/${r.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm"><span className="num font-medium">{r.serial ?? "Propulsor"}</span> <span className="text-fg-muted">· {r.name.split("|").pop()?.trim()}</span></p>
                      <p className="truncate text-xs text-fg-dim">{r.type}{r.where && ` · ${r.where}`}{r.flight ? ` · ${ord(r.flight)}` : ""}{r.turnaround ? ` · ${days(r.turnaround)} desde el anterior` : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Outcome ok={r.success} />
                      <When at={r.net} withTime={false} className="text-[11px] text-fg-dim" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Sin aterrizajes registrados en los últimos meses.</Empty>}
        </Card>
      </div>

      {!d.hasCatalog && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">El catálogo completo de propulsores y zonas de aterrizaje se está descargando de LL2 poco a poco (respetando su límite de peticiones). Los récords aparecerán en las próximas horas.</p>
      )}

      {d.leaders.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Propulsores con más vuelos" />
            <ol className="grid gap-1.5 p-4">
              {d.leaders.map((b, i) => (
                <li key={b.id} className="group grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm" title={`${b.serial}: ${b.flights} vuelos, ${b.landings}/${b.attempts} aterrizajes · ${launcherStatus(b.status)}`}>
                  <span className="num text-xs text-fg-dim">{i + 1}</span>
                  <span className="num truncate font-medium">{b.serial}</span>
                  <span className="relative h-5 overflow-hidden rounded-[3px] bg-surface-2">
                    <span className="absolute inset-y-0 left-0 rounded-[3px] bg-fg-muted/70 transition-colors group-hover:bg-accent" style={{ width: `${(b.flights / maxF) * 100}%` }} />
                  </span>
                  <span className="flex items-center gap-2"><span className="num w-7 text-right">{b.flights}</span><span className="hidden w-16 truncate text-xs text-fg-dim sm:inline">{launcherStatus(b.status)}</span></span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Vuelos por propulsor (primera etapa). Pasa el cursor para ver aterrizajes y estado.</p>
          </Card>

          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
            <Card>
              <CardHeader title="Flota por vehículo" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="label text-left"><th className="px-4 py-2 font-normal">Vehículo</th><th className="px-2 py-2 text-right font-normal">Propuls.</th><th className="px-2 py-2 text-right font-normal">Vuelos</th><th className="px-4 py-2 text-right font-normal">Aterrizajes</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.fleet.map((f) => (
                      <tr key={f.config}>
                        <td className="max-w-40 truncate px-4 py-2">{f.config}</td>
                        <td className="num px-2 py-2 text-right">{f.boosters}{f.active > 0 && <span className="text-fg-dim"> ({f.active})</span>}</td>
                        <td className="num px-2 py-2 text-right">{f.flights}</td>
                        <td className="num px-4 py-2 text-right">{f.attempts ? pct(f.landings, f.attempts) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Entre paréntesis, propulsores activos. Aterrizajes: tasa de éxito sobre intentos.</p>
            </Card>
            {d.fastest.length > 0 && (
              <Card>
                <CardHeader title="Reutilización más rápida" meta="Tiempo entre dos vuelos" />
                <ul className="divide-y divide-line text-sm">
                  {d.fastest.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span><span className="num font-medium">{b.serial}</span> <span className="text-xs text-fg-dim">{b.config}</span></span><span className="num">{days(b.fastest)}</span></li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {d.zones.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Zonas de aterrizaje" meta="Éxitos sobre intentos" />
            <ul className="grid gap-2.5 p-4">
              {d.zones.map((z) => (
                <li key={z.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                  <span className="truncate"><span className="font-medium">{z.abbrev ?? z.name}</span> <span className="text-xs text-fg-dim">{z.abbrev ? z.name : ""}{z.place ? ` · ${z.place}` : ""}</span></span>
                  <span className="num text-xs text-fg-muted">{z.ok}/{z.attempts}</span>
                  <span className="col-span-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                    <span className="h-full rounded-l-full bg-fg-muted/70" style={{ width: `${(z.ok / z.attempts) * 100}%` }} />
                    {z.attempts > z.ok && <span className="h-full rounded-r-full bg-failure" style={{ width: `${((z.attempts - z.ok) / z.attempts) * 100}%` }} />}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-fg-muted/70" /> Exitosos</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-failure" /> Fallidos</span>
            </div>
          </Card>
          {d.types.length > 0 && (
            <Card>
              <CardHeader title="Cómo se recuperan" meta="Aterrizajes del catálogo" />
              <ul className="divide-y divide-line text-sm">
                {d.types.map((x) => (
                  <li key={x.type} className="flex items-center justify-between gap-3 px-4 py-2.5"><span>{x.type}</span><span className="text-xs text-fg-muted"><span className="num text-sm text-fg">{x.n}</span> · {pct(x.ok, x.n)} éxito</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
