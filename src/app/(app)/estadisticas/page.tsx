import type { Metadata } from "next";
import Link from "next/link";
import { Streamed } from "@/components/ui/Streamed";
import clsx from "clsx";
import { Info } from "lucide-react";
import { getBackfillStatus, getStats, type Period } from "@/lib/data/stats";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { CalendarChart, HBar, MonthlyChart, YearsChart } from "@/components/charts/StatsCharts";
import { countryName } from "@/lib/format";

export const metadata: Metadata = {
  title: "Estadísticas",
  description: "Lanzamientos realizados por año, operador, país, vehículo y base, y concentración de la actividad medida con el índice Herfindahl-Hirschman.",
};

const PERIODS: [Period, string][] = [["12m", "Últimos 12 meses"], ["5a", "Últimos 5 años"], ["todo", "Todo el histórico"]];
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es")} %`;
const nf = new Intl.NumberFormat("es");

export default function Page({ searchParams }: PageProps<"/estadisticas">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Estadísticas"
        description="Calculadas a partir de los lanzamientos reales sincronizados desde Launch Library 2. Solo se cuentan los lanzamientos ya realizados (éxito, fallo o fallo parcial)." />
      <Streamed fallback={<div className="h-[60vh] animate-pulse rounded-lg border border-line bg-surface" />}>
        <Content searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/estadisticas">, "searchParams">) {
  const sp = await searchParams;
  const period: Period = sp.p === "5a" || sp.p === "todo" ? sp.p : "12m";
  const [s, bf] = await Promise.all([getStats(period), getBackfillStatus()]);
  const pLabel = PERIODS.find(([p]) => p === period)![1].toLowerCase();
  const year = s.years.at(-1)?.year ?? 0;
  const co = s.concOperators, cc = s.concCountries;
  const hhiLabel = (h: number) => (h > 2500 ? "muy concentrado" : h > 1500 ? "moderadamente concentrado" : "diversificado");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex rounded-md border border-line bg-surface p-0.5 text-[13px]" aria-label="Periodo">
          {PERIODS.map(([p, l]) => (
            <Link key={p} href={p === "12m" ? "/estadisticas" : `/estadisticas?p=${p}`} scroll={false}
              className={clsx("rounded px-3 py-1.5", period === p ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>{l}</Link>
          ))}
        </nav>
        {bf && !bf.done && (
          <p className="flex items-center gap-1.5 text-xs text-fg-dim">
            <Info className="size-3.5" /> Histórico en carga: <span className="num text-fg-muted">{nf.format(s.coverage.synced)}</span>
            {bf.count ? <> de <span className="num">{nf.format(bf.count)}</span></> : null} lanzamientos sincronizados. Las cifras antiguas crecerán solas.
          </p>
        )}
      </div>

      {/* Concentración: el núcleo de la tesis */}
      <Card>
        <CardHeader title="Concentración de la actividad" meta={pLabel} />
        {co ? (
          <div className="grid gap-px bg-line md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              <Kpi label="Lanzamientos" value={nf.format(co.total)} hint={`${co.count} operadores`} />
              <Kpi label="Cuota del n.º 1" value={pct(co.top1)} hint={s.operators[0]?.name} />
              <Kpi label="Cuota del top 3" value={pct(co.top3)} />
              <Kpi label="Operadores para el 50 %" value={co.toHalf} hint="Cuántos suman la mitad" />
            </div>
            <div className="flex flex-col justify-center gap-2 bg-surface p-4 text-sm">
              <p><span className="label mr-2">Índice HHI · operadores</span><span className="num text-lg">{nf.format(co.hhi)}</span> <span className="text-fg-muted">({hhiLabel(co.hhi)})</span></p>
              {cc && <p><span className="label mr-2">Índice HHI · países</span><span className="num text-lg">{nf.format(cc.hhi)}</span> <span className="text-fg-muted">({hhiLabel(cc.hhi)})</span></p>}
              <p className="text-xs leading-relaxed text-fg-dim">
                Índice Herfindahl-Hirschman: suma de las cuotas al cuadrado (0–10 000). Por encima de 2 500 la actividad está dominada por muy pocos actores,
                algo coherente con que la cobertura mediática se concentre en ellos.
              </p>
            </div>
          </div>
        ) : <Empty>Sin datos suficientes en este periodo.</Empty>}
      </Card>

      <Card>
        <CardHeader title="Lanzamientos por año" meta="Éxitos y fallos (total o parcial)" />
        <div className="p-3">{s.years.length ? <YearsChart data={s.years} /> : <Empty>Cargando histórico…</Empty>}</div>
        <DataTable head={["Año", "Éxitos", "Fallos"]} rows={s.years.slice().reverse().map((y) => [y.year, y.success, y.failure])} />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por operador" meta={pLabel} />
          <div className="p-3">{s.operators.length ? <HBar rows={s.operators} hrefBase="/organizaciones/" label="Lanzamientos por operador" /> : <Empty>Sin datos.</Empty>}</div>
          <DataTable head={["Operador", "Lanzamientos"]} rows={s.operators.map((o) => [o.name, o.n])} />
        </Card>
        <Card>
          <CardHeader title="Por país de la base" meta={pLabel} />
          <div className="p-3">{s.countries.length ? <HBar rows={s.countries.map((c) => ({ id: c.code, name: countryName(c.code) ?? c.code, n: c.n }))} label="Lanzamientos por país" /> : <Empty>Sin datos.</Empty>}</div>
          <DataTable head={["País", "Lanzamientos"]} rows={s.countries.map((c) => [countryName(c.code) ?? c.code, c.n])} />
        </Card>
        <Card>
          <CardHeader title="Vehículos más utilizados" meta={pLabel} />
          <div className="p-3">{s.rockets.length ? <HBar rows={s.rockets} hrefBase="/vehiculos/" label="Vehículos más utilizados" /> : <Empty>Sin datos.</Empty>}</div>
          <DataTable head={["Vehículo", "Vuelos", "Éxito"]} rows={s.rockets.map((r) => [r.name, r.n, pct(r.success / r.n)])} />
        </Card>
        <Card>
          <CardHeader title="Actividad por base" meta={pLabel} />
          <div className="p-3">{s.bases.length ? <HBar rows={s.bases} hrefBase="/bases/" label="Lanzamientos por base" /> : <Empty>Sin datos.</Empty>}</div>
          <DataTable head={["Base", "Lanzamientos"]} rows={s.bases.map((b) => [b.name, b.n])} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividad mensual" meta="24 meses + 3 meses programados" />
        <div className="p-3"><MonthlyChart data={s.monthly} /></div>
      </Card>

      {year > 0 && (
        <Card>
          <CardHeader title={`Calendario ${year}`} meta="Lanzamientos realizados por día" />
          <div className="overflow-x-auto p-3"><div className="min-w-[640px]"><CalendarChart data={s.calendar} year={year} /></div></div>
        </Card>
      )}
    </div>
  );
}

/** Vista de tabla accesible para cada gráfica. */
function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return null;
  return (
    <details className="border-t border-line">
      <summary className="cursor-pointer px-4 py-2.5 text-xs text-fg-dim select-none hover:text-fg-muted">Ver como tabla</summary>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-2 text-left"><tr>{head.map((h) => <th key={h} className="label px-4 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={clsx("px-4 py-1.5", j > 0 && "num text-fg-muted")}>{typeof c === "number" ? nf.format(c) : c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}
