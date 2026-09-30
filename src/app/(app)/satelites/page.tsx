import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Info } from "lucide-react";
import { CATEGORIES, FEATURED, GROUPS, getGroup, type GroupCategory, type GroupKey } from "@/lib/satellites";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { SatSearch } from "@/components/orbit/SatSearch";
import { ConstellationGlobe } from "@/components/orbit/ConstellationGlobe";

export const metadata: Metadata = { title: "Satélites" };

export default function Page() {
  const cats = Object.keys(CATEGORIES) as GroupCategory[];
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader eyebrow="Explorar" title="Satélites"
        description="Todo lo que está en órbita según el catálogo público de CelesTrak: estaciones, megaconstelaciones, navegación, meteorología, ciencia y más. Posiciones calculadas en tu navegador con el modelo SGP4." />
      <SatSearch />

      <Card className="overflow-hidden">
        <CardHeader title="Estaciones y objetos asociados, ahora" action={<Link href="/satelites/grupo/stations" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Ver grupo <ArrowRight className="size-3.5" /></Link>} />
        <Suspense fallback={<div className="h-[440px] animate-pulse bg-surface" />}><StationsGlobe /></Suspense>
      </Card>

      <section>
        <h2 className="label mb-2">Destacados</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {FEATURED.map((f) => (
            <Link key={f.norad} href={`/satelites/${f.norad}`} className="bg-surface p-4 transition-colors hover:bg-surface-2">
              <p className="font-medium">{f.name}</p>
              <p className="text-xs text-fg-dim">{f.note}</p>
              <p className="num mt-2 text-[11px] text-fg-muted">NORAD {f.norad}</p>
            </Link>
          ))}
        </div>
      </section>

      {cats.map((c) => {
        const groups = (Object.keys(GROUPS) as GroupKey[]).filter((g) => GROUPS[g].cat === c);
        if (!groups.length) return null;
        return (
          <section key={c}>
            <h2 className="label mb-2">{CATEGORIES[c]}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map((g) => (
                <Link key={g} href={`/satelites/grupo/${g}`} className="group flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                  <p className="font-medium">{GROUPS[g].label}</p>
                  <p className="mt-1 text-sm text-fg-muted">{GROUPS[g].desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-accent opacity-80 group-hover:opacity-100">Explorar en 3D y tabla <ArrowRight className="size-3.5" /></span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <p className="flex gap-2 text-xs text-fg-dim">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Fuente: CelesTrak (GP/SATCAT). Los datos se descargan como máximo una vez cada 3 h, respetando su política de uso. Las posiciones son cálculos a partir de elementos orbitales, no telemetría.
      </p>
    </div>
  );
}

async function StationsGlobe() {
  const objs = await getGroup("stations");
  if (!objs?.length) return <p className="p-6 text-sm text-fg-dim">CelesTrak no está disponible en este momento.</p>;
  return <ConstellationGlobe objects={objs} height={440} />;
}
