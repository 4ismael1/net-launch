import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getProgram, listPrograms, programType } from "@/lib/data/catalog";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Kpi } from "@/components/ui/Card";
import { Facts, LaunchListCard, YearBars } from "@/components/entity/shared";
import { About } from "@/components/ui/About";

// Solo enteros positivos que caben en un int4 de Postgres; lo demás es 404 sin consultar la BD
const toId = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : null);

export async function generateStaticParams() {
  const ids = (await listPrograms()).slice(0, 12).map((p) => ({ id: String(p.id) }));
  return ids.length ? ids : [{ id: "1" }]; // Next exige al menos uno (el catálogo puede estar descargándose aún)
}

export async function generateMetadata({ params }: PageProps<"/programas/[id]">): Promise<Metadata> {
  const id = toId((await params).id);
  const d = id ? await getProgram(id) : null;
  if (!d) return { title: "Programa no encontrado" };
  return { title: d.program.name, description: (d.program.descriptionEs ?? d.program.description)?.slice(0, 160) ?? `${d.program.name}: misiones, próximos vuelos y cronología.` };
}

export default function Page({ params }: PageProps<"/programas/[id]">) {
  return (
    <Streamed fallback={<div className="mx-auto h-96 max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Streamed>
  );
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

async function Content({ params }: Pick<PageProps<"/programas/[id]">, "params">) {
  const id = toId((await params).id);
  const [d, all] = await Promise.all([id ? getProgram(id) : null, listPrograms()]);
  if (!d) notFound();
  const { program: p } = d;
  // "Hoy" según los datos (último lanzamiento registrado): un fin con fecha futura sigue "en curso"
  const today = Math.max(0, ...all.map((x) => (x.last ? Date.parse(x.last) : 0)));
  const ended = !!p.end && Date.parse(p.end) <= today && !p.upcoming;
  const done = d.years.reduce((s, y) => s + y.success + y.failure, 0);
  const ok = d.years.reduce((s, y) => s + y.success, 0);
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <header className="relative overflow-hidden rounded-lg border border-line bg-surface p-5 md:p-7">
        {p.imageBig && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageBig} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-25 md:w-3/5" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/30" />
          </>
        )}
        <div className="relative max-w-2xl">
          <p className="label mb-1">{programType(p.type) ?? "Programa"}{ended ? " · Finalizado" : " · En curso"}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{p.name}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {p.agencies.map((a, i) => <span key={a.id}>{i > 0 && " · "}<Link href={`/organizaciones/${a.id}`} className="hover:text-fg hover:underline">{a.name}</Link></span>)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.upcoming > 0 && <a href="#proximos" className="inline-flex h-9 items-center rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">Próximos vuelos</a>}
            {p.infoUrl && <a href={p.infoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2">Sitio oficial <ExternalLink className="size-3.5" /></a>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Lanzamientos" value={p.launches} hint="Con resultado registrado" />
        <Kpi label="Próximos" value={p.upcoming} />
        <Kpi label="Tasa de éxito" value={done ? `${(Math.round((ok / done) * 1000) / 10).toLocaleString("es")} %` : "—"} />
        <Kpi label="Desde" value={p.start ? new Date(p.start).getUTCFullYear() : "—"} hint={p.end ? `${ended ? "Hasta" : "Previsto hasta"} ${new Date(p.end).getUTCFullYear()}` : "Sigue activo"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <About title="Acerca del programa" text={p.description} esOverride={p.descriptionEs} wikiUrl={p.wikiUrl} />
          <div id="proximos" className="scroll-mt-20"><LaunchListCard title="Próximos vuelos" rows={d.upcoming} empty="Sin vuelos programados." /></div>
          <LaunchListCard title="Vuelos recientes" rows={d.recent} empty="Sin resultados registrados todavía." />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Datos" />
            <Facts items={[
              ["Tipo", programType(p.type)],
              ["Inicio", fmt(p.start)],
              ["Fin", fmt(p.end) ?? (p.start ? "En curso" : null)],
              ["Último vuelo", fmt(p.last)],
              ["Próximo vuelo", fmt(p.next)],
            ]} />
          </Card>
          {d.rockets.length > 0 && (
            <Card>
              <CardHeader title="Vehículos usados" />
              <ul className="divide-y divide-line text-sm">
                {d.rockets.map((r) => (
                  <li key={r.id}><Link href={`/vehiculos/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"><span className="truncate">{r.name}</span><span className="num text-fg-muted">{r.n}</span></Link></li>
                ))}
              </ul>
            </Card>
          )}
          {d.years.length > 0 && <Card><CardHeader title="Vuelos por año" /><YearBars data={d.years} /></Card>}
        </div>
      </div>
    </div>
  );
}
