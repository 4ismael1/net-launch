import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Streamed } from "@/components/ui/Streamed";
import { MapPin } from "lucide-react";
import { getLocation } from "@/lib/data/entities";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { Facts, LaunchListCard, YearBars } from "@/components/entity/shared";
import { MiniMap } from "@/components/map/MiniMap";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { Flag } from "@/components/ui/Flag";
import { countryName, padName } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/bases/[id]">): Promise<Metadata> {
  const d = await getLocation(Number((await params).id));
  return { title: d?.loc.name ?? "Base" };
}

export default function Page({ params }: PageProps<"/bases/[id]">) {
  return (
    <Streamed fallback={<div className="mx-auto h-96 max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Streamed>
  );
}

async function Content({ params }: Pick<PageProps<"/bases/[id]">, "params">) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getLocation(id) : null;
  if (!d) notFound();
  const { loc } = d;
  const upcomingPads = d.pads.filter((p) => p.upcoming > 0).length;
  const firstPad = d.pads.find((p) => p.lat != null);

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-line bg-surface p-5 md:p-6">
        <div>
          <p className="label mb-1">Base espacial</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{loc.name}</h1>
          <p className="mt-1.5 text-sm text-fg-muted"><Flag code={loc.countryCode} /> {countryName(loc.countryCode) ?? loc.countryName ?? "—"}
            {loc.latitude != null && loc.longitude != null && <span className="num text-fg-dim"> · {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°</span>}</p>
        </div>
        {firstPad && <Link href={`/mapa?pad=${firstPad.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90"><MapPin className="size-4" /> Abrir en el mapa</Link>}
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Lanzamientos" value={(loc.totalLaunchCount ?? 0).toLocaleString("es")} hint="Total según LL2" />
        <Kpi label="Plataformas" value={d.pads.length} />
        <Kpi label="Con próximos" value={upcomingPads} hint="Plataformas" />
        <Kpi label="Operadores" value={d.operators.length} hint="Registrados aquí" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          {loc.description && (
            <Card><CardHeader title="Descripción" meta="Launch Library 2 (inglés)" /><p lang="en" className="p-4 text-sm leading-relaxed">{loc.description}</p></Card>
          )}
          <LaunchListCard title="Próximos lanzamientos" rows={d.upcoming} empty="Sin lanzamientos programados." more={`/lanzamientos?base=${loc.id}`} />
          <LaunchListCard title="Lanzamientos recientes" rows={d.recent} empty="Sin resultados registrados todavía." more={`/lanzamientos?vista=pasados&base=${loc.id}`} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          {firstPad?.lat != null && firstPad.lng != null && (
            <Card className="overflow-hidden"><CardHeader title="Ubicación" /><MiniMap lat={firstPad.lat} lng={firstPad.lng} label={loc.name} /></Card>
          )}
          {firstPad?.lat != null && firstPad.lng != null && (
            <Streamed fallback={null}><WeatherCard lat={firstPad.lat} lng={firstPad.lng} place={loc.name} /></Streamed>
          )}
          <Card>
            <CardHeader title="Plataformas" meta={String(d.pads.length)} />
            {d.pads.length ? (
              <ul className="divide-y divide-line text-sm">
                {d.pads.map((p) => (
                  <li key={p.id}>
                    <Link href={`/mapa?pad=${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0"><span className="block truncate">{padName(p.name)}</span><span className="text-xs text-fg-dim">{p.active === false ? "Inactiva" : "Activa"} · {p.total} lanzamientos</span></span>
                      {p.upcoming > 0 && <span className="num shrink-0 text-xs text-accent">{p.upcoming} próximos</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>Sin plataformas registradas.</Empty>}
          </Card>
          <Card><CardHeader title="Actividad por año" /><YearBars data={d.years} /></Card>
          {d.operators.length > 0 && (
            <Card>
              <CardHeader title="Operadores" />
              <Facts items={d.operators.map((o) => [o.name, <Link key={o.id} href={`/organizaciones/${o.id}`} className="num hover:underline">{o.n}</Link>])} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
