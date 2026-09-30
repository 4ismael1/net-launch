import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Streamed } from "@/components/ui/Streamed";
import { ExternalLink } from "lucide-react";
import { getOrganization, typeLabel } from "@/lib/data/entities";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { Facts, LaunchListCard, Logo, YearBars } from "@/components/entity/shared";
import { Flag } from "@/components/ui/Flag";
import { countryName } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/organizaciones/[id]">): Promise<Metadata> {
  const d = await getOrganization(Number((await params).id));
  return { title: d?.org.name ?? "Organización" };
}

export default function Page({ params }: PageProps<"/organizaciones/[id]">) {
  return (
    <Streamed fallback={<div className="mx-auto h-96 max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Streamed>
  );
}

async function Content({ params }: Pick<PageProps<"/organizaciones/[id]">, "params">) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getOrganization(id) : null;
  if (!d) notFound();
  const { org } = d;
  const done = (org.successfulLaunches ?? 0) + (org.failedLaunches ?? 0);
  const rate = done ? Math.round(((org.successfulLaunches ?? 0) / done) * 1000) / 10 : null;
  const desc = org.descriptionEs ?? org.description;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <header className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-surface p-5 md:p-6">
        <Logo src={org.logoUrl} alt={org.abbrev ?? org.name} size={72} />
        <div className="min-w-0 flex-1">
          <p className="label mb-1">{typeLabel(org.type)}{org.abbrev && ` · ${org.abbrev}`}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{org.name}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {(org.countryCodes ?? []).map((c) => <span key={c} className="mr-3"><Flag code={c} /> {countryName(c)}</span>)}
          </p>
        </div>
        <div className="flex gap-2">
          {org.infoUrl && <a href={org.infoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2">Sitio oficial <ExternalLink className="size-3.5" /></a>}
          {org.wikiUrl && <a href={org.wikiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-fg-muted hover:bg-surface-2">Wikipedia <ExternalLink className="size-3.5" /></a>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Lanzamientos" value={org.totalLaunchCount?.toLocaleString("es") ?? "—"} hint="Total según LL2" />
        <Kpi label="Exitosos" value={org.successfulLaunches?.toLocaleString("es") ?? "—"} />
        <Kpi label="Tasa de éxito" value={rate === null ? "—" : `${rate.toLocaleString("es")} %`} />
        <Kpi label="Pendientes" value={org.pendingLaunches?.toLocaleString("es") ?? "—"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Acerca de" />
            {desc ? (
              <div className="p-4 text-sm leading-relaxed">
                <p>{desc}</p>
                {org.descriptionEs && <p className="mt-2 text-[11px] text-fg-dim">Traducción automática (Gemini) del texto de Launch Library 2.</p>}
              </div>
            ) : <Empty>No hay una descripción pública disponible.</Empty>}
          </Card>
          <LaunchListCard title="Próximos lanzamientos" rows={d.upcoming} empty="Sin lanzamientos programados." more={`/lanzamientos?op=${org.id}`} />
          <LaunchListCard title="Lanzamientos recientes" rows={d.recent} empty="Sin resultados registrados todavía." more={`/lanzamientos?vista=pasados&op=${org.id}`} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Datos" />
            <Facts items={[
              ["Fundación", org.foundingYear],
              ["Dirección", d.administrator],
              ["Lanzadores", d.launchers],
              ["Naves", d.spacecraft],
              ["Fallidos", org.failedLaunches],
            ]} />
          </Card>
          <Card>
            <CardHeader title="Actividad por año" meta="Datos sincronizados" />
            <YearBars data={d.years} />
          </Card>
          {d.rockets.length > 0 && (
            <Card>
              <CardHeader title="Cohetes utilizados" />
              <ul className="divide-y divide-line text-sm">
                {d.rockets.map((r) => (
                  <li key={r.id}><Link href={`/vehiculos/${r.id}`} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="truncate">{r.name}</span><span className="num text-fg-muted">{r.n}</span></Link></li>
                ))}
              </ul>
            </Card>
          )}
          {d.pads.length > 0 && (
            <Card>
              <CardHeader title="Bases utilizadas" />
              <ul className="divide-y divide-line text-sm">
                {d.pads.map((p) => (
                  <li key={p.id}><Link href={`/bases/${p.id}`} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="truncate">{p.name}</span><span className="num text-fg-muted">{p.n}</span></Link></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
