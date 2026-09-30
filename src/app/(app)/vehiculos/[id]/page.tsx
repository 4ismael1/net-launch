import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { getRocket } from "@/lib/data/entities";
import { Card, CardHeader, Kpi } from "@/components/ui/Card";
import { Facts, LaunchListCard, YearBars } from "@/components/entity/shared";
import { Flag } from "@/components/ui/Flag";

export async function generateMetadata({ params }: PageProps<"/vehiculos/[id]">): Promise<Metadata> {
  const d = await getRocket(Number((await params).id));
  return { title: d?.rocket.fullName ?? d?.rocket.name ?? "Vehículo" };
}

export default function Page({ params }: PageProps<"/vehiculos/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Suspense>
  );
}

const unit = (v: number | null | undefined, u: string) => (v == null ? null : `${v.toLocaleString("es")} ${u}`);

async function Content({ params }: Pick<PageProps<"/vehiculos/[id]">, "params">) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getRocket(id) : null;
  if (!d) notFound();
  const { rocket: r, maker, specs } = d;
  const done = (r.successfulLaunches ?? 0) + (r.failedLaunches ?? 0);
  const rate = done ? Math.round(((r.successfulLaunches ?? 0) / done) * 1000) / 10 : null;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <header className="relative overflow-hidden rounded-lg border border-line bg-surface p-5 md:p-6">
        {r.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/40" />
          </>
        )}
        <div className="relative">
          <p className="label mb-1">{r.family ?? "Vehículo"}{r.active === false && " · Retirado"}{r.reusable && " · Reutilizable"}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{r.fullName ?? r.name}</h1>
          {maker && <p className="mt-1.5 text-sm text-fg-muted"><Flag code={maker.countryCodes?.[0]} /> <Link href={`/organizaciones/${maker.id}`} className="hover:underline">{maker.name}</Link></p>}
          {r.wikiUrl && <a href={r.wikiUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Wikipedia <ExternalLink className="size-3" /></a>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Vuelos" value={r.totalLaunchCount ?? "—"} hint="Total según LL2" />
        <Kpi label="Exitosos" value={r.successfulLaunches ?? "—"} />
        <Kpi label="Tasa de éxito" value={rate === null ? "—" : `${rate.toLocaleString("es")} %`} />
        <Kpi label="Aterrizajes" value={specs.landings ?? "—"} hint="Exitosos" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          {r.description && <Card><CardHeader title="Descripción" meta="Launch Library 2 (inglés)" /><p lang="en" className="p-4 text-sm leading-relaxed">{r.description}</p></Card>}
          <LaunchListCard title="Próximos vuelos" rows={d.upcoming} empty="Sin vuelos programados." more={`/lanzamientos?cohete=${r.id}`} />
          <LaunchListCard title="Vuelos recientes" rows={d.recent} empty="Sin resultados registrados todavía." more={`/lanzamientos?vista=pasados&cohete=${r.id}`} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Especificaciones" />
            <Facts items={[
              ["Altura", unit(r.length, "m")],
              ["Diámetro", unit(r.diameter, "m")],
              ["Etapas", specs.stages as number | null],
              ["Masa al despegue", unit(specs.launchMass, "t")],
              ["Empuje al despegue", unit(specs.thrust, "kN")],
              ["Carga a LEO", unit(r.leoCapacity, "kg")],
              ["Carga a GTO", unit(r.gtoCapacity, "kg")],
              ["Carga a SSO", unit(specs.ssoCapacity, "kg")],
              ["Primer vuelo", r.maidenFlight],
            ]} />
          </Card>
          <Card><CardHeader title="Vuelos por año" /><YearBars data={d.years} /></Card>
        </div>
      </div>
    </div>
  );
}
