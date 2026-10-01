import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { astroStatus, getAstronaut } from "@/lib/data/catalog";
import { getInSpace } from "@/lib/data/space";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Kpi } from "@/components/ui/Card";
import { Facts, LaunchListCard } from "@/components/entity/shared";
import { About } from "@/components/ui/About";
import { Flag } from "@/components/ui/Flag";
import { countryName, durLabel } from "@/lib/format";

export async function generateStaticParams() {
  const ids = ((await getInSpace())?.astronauts ?? []).slice(0, 12).map((a) => ({ id: String(a.id) }));
  return ids.length ? ids : [{ id: "1" }]; // Next exige al menos uno (el catálogo puede estar descargándose aún)
}

export async function generateMetadata({ params }: PageProps<"/astronautas/[id]">): Promise<Metadata> {
  const d = await getAstronaut(Number((await params).id));
  return { title: d?.astronaut.name ?? "Astronauta" };
}

export default function Page({ params }: PageProps<"/astronautas/[id]">) {
  return (
    <Streamed fallback={<div className="mx-auto h-96 max-w-[1200px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Streamed>
  );
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

async function Content({ params }: Pick<PageProps<"/astronautas/[id]">, "params">) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await getAstronaut(id) : null;
  if (!d) notFound();
  const a = d.astronaut;
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-4">
      <Link href="/astronautas" className="inline-flex w-fit items-center gap-1.5 text-xs text-fg-muted hover:text-fg"><ArrowLeft className="size-3.5" /> Astronautas</Link>
      <header className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-end md:p-6">
        <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-md bg-surface-3">
          {a.imageBig ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.imageBig} alt={a.name} className="size-full object-cover" />
          ) : <User className="absolute inset-0 m-auto size-8 text-fg-dim" />}
        </div>
        <div className="min-w-0">
          <p className="label mb-1">{astroStatus(a.status) ?? "Astronauta"}{a.inSpace && <span className="!text-accent"> · En el espacio ahora</span>}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{a.name}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            <Flag code={a.country} /> {countryName(a.country) ?? a.countryName ?? "—"}
            {a.agency && <> · {a.agencyId ? <Link href={`/organizaciones/${a.agencyId}`} className="hover:text-fg hover:underline">{a.agency}</Link> : a.agency}</>}
          </p>
          {a.inSpace && <Link href="/en-el-espacio" className="mt-3 inline-flex h-8 items-center rounded-md bg-fg px-3 text-xs font-medium text-bg hover:opacity-90">Ver dónde está ahora</Link>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Tiempo en el espacio" value={durLabel(a.timeInSpace)} />
        <Kpi label="Vuelos" value={a.flights} />
        <Kpi label="Paseos espaciales" value={a.spacewalks} hint={a.eva ? `${durLabel(a.eva)} fuera de la nave` : undefined} />
        <Kpi label="Primer vuelo" value={a.first ? new Date(a.first).getUTCFullYear() : "—"} hint={a.last && a.last !== a.first ? `Último: ${new Date(a.last).getUTCFullYear()}` : undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <About title="Biografía" text={a.bio} esOverride={d.bioEs} wikiUrl={a.wiki} />
          {d.flights.length > 0 && <LaunchListCard title="Vuelos registrados" rows={d.flights} empty="" />}
        </div>
        <Card className="h-fit">
          <CardHeader title="Datos" />
          <Facts items={[
            ["Nacimiento", fmt(a.born)],
            ["Fallecimiento", fmt(a.died)],
            ["Edad", a.age && !a.died ? `${a.age} años` : null],
            ["Agencia", a.agency],
            ["Primer vuelo", fmt(a.first)],
            ["Último vuelo", fmt(a.last)],
          ]} />
        </Card>
      </div>
    </div>
  );
}
