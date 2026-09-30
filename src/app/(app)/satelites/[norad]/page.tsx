import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, ExternalLink, Rocket } from "lucide-react";
import { getSatellite, launchForObject, OBJECT_TYPES, OPS_STATUS } from "@/lib/satellites";
import { derived, orbitClass } from "@/lib/orbit";
import { Card, CardHeader, Empty } from "@/components/ui/Card";
import { Facts } from "@/components/entity/shared";
import { OrbitViewer } from "@/components/orbit/OrbitViewer";
import { SatLive } from "@/components/orbit/SatLive";
import { LocalTime } from "@/components/launch/LocalTime";

export function generateStaticParams() {
  return [{ norad: "25544" }];
}

export async function generateMetadata({ params }: PageProps<"/satelites/[norad]">): Promise<Metadata> {
  const n = Number((await params).norad);
  const d = Number.isInteger(n) ? await getSatellite(n) : null;
  return { title: d?.omm?.OBJECT_NAME ?? d?.meta?.OBJECT_NAME ?? "Satélite" };
}

export default function Page({ params }: PageProps<"/satelites/[norad]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Suspense>
  );
}

const nf = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d });

async function Content({ params }: Pick<PageProps<"/satelites/[norad]">, "params">) {
  const norad = Number((await params).norad);
  if (!Number.isInteger(norad) || norad <= 0) notFound();
  const { omm, meta, unavailable } = await getSatellite(norad);
  if (!omm && !meta) {
    if (unavailable) return <Card><Empty>CelesTrak no está disponible en este momento.</Empty></Card>;
    notFound();
  }
  const launch = await launchForObject(omm?.OBJECT_ID ?? meta?.OBJECT_ID);
  const x = omm ? derived(omm) : null;
  const name = omm?.OBJECT_NAME ?? meta!.OBJECT_NAME;
  const decayed = !!meta?.DECAY_DATE;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <nav className="flex items-center gap-1 text-xs text-fg-dim" aria-label="Ruta">
        <Link href="/satelites" className="hover:text-fg">Satélites</Link><ChevronRight className="size-3" /><span className="text-fg-muted">{name}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-line bg-surface p-5">
        <div>
          <p className="label mb-1">NORAD {norad}{omm && ` · COSPAR ${omm.OBJECT_ID}`}{omm && ` · ${orbitClass(omm)}`}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {meta ? `${OBJECT_TYPES[meta.OBJECT_TYPE] ?? meta.OBJECT_TYPE} · ${OPS_STATUS[meta.OPS_STATUS_CODE] ?? "Estado desconocido"}` : "Sin ficha SATCAT"}
            {decayed && <span className="text-failure"> · Reentró el {meta!.DECAY_DATE}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {launch && (
            <Link href={`/lanzamientos/${launch.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">
              <Rocket className="size-4" /> Ver su lanzamiento
            </Link>
          )}
          <a href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${norad}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2">
            CelesTrak <ExternalLink className="size-3.5" />
          </a>
        </div>
      </header>

      {omm && !decayed ? (
        <>
          <SatLive omm={omm} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden"><CardHeader title="Órbita en 3D" /><OrbitViewer objects={[omm]} height={420} /></Card>
            <Card>
              <CardHeader title="Elementos orbitales" meta={<>Época <LocalTime date={`${omm.EPOCH}Z`} mode="relative" /></>} />
              <Facts items={[
                ["Perigeo", `${nf(x!.perigeeKm)} km`],
                ["Apogeo", `${nf(x!.apogeeKm)} km`],
                ["Periodo", `${nf(x!.periodMin, 1)} min`],
                ["Órbitas por día", nf(omm.MEAN_MOTION, 2)],
                ["Inclinación", `${nf(omm.INCLINATION, 2)}°`],
                ["Excentricidad", omm.ECCENTRICITY.toFixed(6)],
                ["Ascensión recta del nodo", `${nf(omm.RA_OF_ASC_NODE, 2)}°`],
                ["Argumento del perigeo", `${nf(omm.ARG_OF_PERICENTER, 2)}°`],
                ["Revoluciones en la época", nf(omm.REV_AT_EPOCH)],
                ["BSTAR (arrastre)", omm.BSTAR.toExponential(3)],
              ]} />
            </Card>
          </div>
        </>
      ) : (
        <Card><Empty>{decayed ? "Este objeto ya reentró en la atmósfera; no hay elementos orbitales vigentes." : "No hay elementos orbitales públicos para este objeto."}</Empty></Card>
      )}

      {meta && (
        <Card>
          <CardHeader title="Ficha del catálogo (SATCAT)" />
          <Facts items={[
            ["Propietario / país (código SATCAT)", meta.OWNER],
            ["Fecha de lanzamiento", meta.LAUNCH_DATE],
            ["Sitio de lanzamiento (código)", meta.LAUNCH_SITE],
            ["Tipo de objeto", OBJECT_TYPES[meta.OBJECT_TYPE] ?? meta.OBJECT_TYPE],
            ["Sección radar (RCS)", meta.RCS ? `${nf(meta.RCS, 2)} m²` : null],
            ["Reentrada", meta.DECAY_DATE || null],
          ]} />
        </Card>
      )}
    </div>
  );
}
