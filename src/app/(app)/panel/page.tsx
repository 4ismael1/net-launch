import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getKpis, getNextLaunch, getPadPoints, getRecent, getSpotlight, getUpcoming } from "@/lib/data/launches";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { NextLaunchHero } from "@/components/launch/NextLaunchHero";
import { LaunchRow } from "@/components/launch/LaunchRow";
import { PadDotMap } from "@/components/launch/PadDotMap";
import { countryName } from "@/lib/format";
import { Flag } from "@/components/ui/Flag";

export const metadata: Metadata = { title: "Panel" };

const nf = new Intl.NumberFormat("es");

export default async function PanelPage() {
  const [next, upcoming, recent, kpis, spotlight, pads] = await Promise.all([
    getNextLaunch(),
    getUpcoming(8),
    getRecent(6),
    getKpis(),
    getSpotlight(),
    getPadPoints(),
  ]);
  const successRate = kpis.year_done ? Math.round((kpis.year_success / kpis.year_done) * 1000) / 10 : null;
  const year = kpis.year;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      {next ? <NextLaunchHero l={next} /> : <Card><Empty>No hay lanzamientos próximos en los datos.</Empty></Card>}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Próximos" value={nf.format(kpis.upcoming)} hint="Programados" />
        <Kpi label="Este mes" value={nf.format(kpis.month)} hint="Previstos y realizados" />
        <Kpi label={`Realizados ${year}`} value={nf.format(kpis.year_done)} hint="Éxitos y fallos" />
        <Kpi label={`Éxito ${year}`} value={successRate === null ? "—" : `${successRate} %`} hint={`${nf.format(kpis.year_success)} exitosos`} />
        <Kpi label="Países" value={nf.format(kpis.countries)} hint="Con bases activas (12 meses)" />
        <Kpi label="Operadores" value={nf.format(kpis.operators)} hint="Activos (12 meses)" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Actividad mundial"
            meta={`${pads.length} plataformas`}
            action={<Link href="/mapa" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Abrir mapa <ArrowRight className="size-3.5" /></Link>}
          />
          <div className="p-3">
            <PadDotMap points={pads} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Próximos lanzamientos"
            action={<Link href="/lanzamientos" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Ver todos <ArrowRight className="size-3.5" /></Link>}
          />
          {upcoming.length ? (
            <ul className="divide-y divide-line">{upcoming.slice(next ? 1 : 0, 8).map((l) => <LaunchRow key={l.id} l={l} />)}</ul>
          ) : (
            <Empty>Sin datos.</Empty>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Resultados recientes"
            action={<Link href="/lanzamientos?vista=pasados" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Histórico <ArrowRight className="size-3.5" /></Link>}
          />
          {recent.length ? (
            <ul className="divide-y divide-line">{recent.map((l) => <LaunchRow key={l.id} l={l} showCountdown={false} />)}</ul>
          ) : (
            <Empty>El histórico se está cargando.</Empty>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Menos conocidos · hoy" meta="Fuera del top 5 por actividad" />
          {spotlight ? (
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-white/95 p-1">
                  {spotlight.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={spotlight.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="font-mono text-xs text-bg">{spotlight.abbrev}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{spotlight.name}</p>
                  <p className="text-xs text-fg-dim">
                    {spotlight.country_codes?.slice(0, 3).map((c) => <span key={c} className="mr-2"><Flag code={c} /> {countryName(c)}</span>)}
                    {spotlight.type && ` · ${spotlight.type}`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
                <Kpi label="Próximos" value={spotlight.upcoming} />
                <Kpi label="Últimos 2 años" value={spotlight.recent} />
                <Kpi label="Total" value={spotlight.total ?? "—"} />
              </div>
              <Link href={`/organizaciones/${spotlight.id}`} className="mt-auto flex items-center gap-1 text-sm text-accent hover:underline">
                Conocer esta organización <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <Empty>Calculando…</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
