import type { Metadata } from "next";
import Link from "next/link";
import { User } from "lucide-react";
import { getInSpace, isoDays } from "@/lib/data/space";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { LocalTime } from "@/components/launch/LocalTime";
import { countryName } from "@/lib/format";
import { Suspense } from "react";
import { getStationsGP } from "@/lib/orbit";
import { OrbitViewer } from "@/components/orbit/OrbitViewer";

export const metadata: Metadata = { title: "En el espacio" };

export default async function Page() {
  const data = await getInSpace();
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Explorar" title="En el espacio ahora"
        description="Personas en órbita y estaciones espaciales activas según Launch Library 2, con la posición calculada de la ISS y Tiangong." />
      {!data ? (
        <Card><Empty>Los datos se cargarán en la próxima sincronización.</Empty></Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
            <Kpi label="Personas en órbita" value={data.astronauts.length} />
            <Kpi label="Estaciones activas" value={data.stations.length} />
            <Kpi label="Países representados" value={new Set(data.astronauts.flatMap((a) => a.nationality)).size} />
            <Kpi label="Actualizado" value={<LocalTime date={new Date(data.at)} mode="relative" className="text-lg" />} />
          </div>

          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-lg border border-line bg-surface" />}>
            <StationsOrbit />
          </Suspense>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.stations.map((s) => {
              const crew = s.crew ?? 0;
              return (
                <Card key={s.id} className="overflow-hidden">
                  <div className="relative h-40 bg-surface-3">
                    {s.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" className="size-full object-cover opacity-70" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <p className="label !text-fg-muted">{s.orbit}</p>
                      <h2 className="text-lg font-semibold">{s.name}</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
                    <Kpi label="Tripulación" value={crew} />
                    <Kpi label="Naves acopladas" value={s.docked ?? "—"} />
                    <Kpi label="En órbita desde" value={s.founded ? new Date(s.founded).getUTCFullYear() : "—"} />
                  </div>
                  <div className="space-y-2 p-4 text-sm">
                    {s.expeditions.length > 0 && <p><span className="label mr-2">Expedición</span>{s.expeditions.map((e) => e.name).join(", ")}</p>}
                    {s.owners.length > 0 && (
                      <p className="text-fg-muted"><span className="label mr-2">Operan</span>
                        {s.owners.map((o, i) => <span key={o.id}>{i > 0 && ", "}<Link href={`/organizaciones/${o.id}`} className="hover:text-fg hover:underline">{o.name}</Link></span>)}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader title="Personas en órbita" meta={String(data.astronauts.length)} />
            <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
              {data.astronauts.map((a) => {
                const days = isoDays(a.timeInSpace);
                return (
                  <li key={a.id} className="flex items-center gap-3 bg-surface p-4">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-3">
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                      ) : <User className="size-5 text-fg-dim" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{a.name}</p>
                      <p className="truncate text-xs text-fg-dim">
                        {a.nationality.map((c) => <span key={c} className="mr-1.5"><Flag code={c} /> {countryName(c)}</span>)}
                        {a.agencyId ? <Link href={`/organizaciones/${a.agencyId}`} className="hover:text-fg">· {a.agencyAbbrev ?? a.agency}</Link> : a.agency && `· ${a.agency}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-fg-dim">
                        {days !== null && <><span className="num text-fg-muted">{days.toLocaleString("es")}</span> días en el espacio (acumulado)</>}
                        {a.spacewalks ? <> · <span className="num">{a.spacewalks}</span> EVA</> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

async function StationsOrbit() {
  const gp = await getStationsGP();
  if (!gp.length) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Estaciones ahora" meta="ISS · Tiangong" />
      <OrbitViewer objects={gp} height={420} />
    </Card>
  );
}
