import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { GROUPS, getGroup, isGroup } from "@/lib/satellites";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { ConstellationGlobe } from "@/components/orbit/ConstellationGlobe";
import { SatTable } from "@/components/orbit/SatTable";
import { orbitClass } from "@/lib/orbit";

export function generateStaticParams() {
  return [{ g: "stations" }];
}

export async function generateMetadata({ params }: PageProps<"/satelites/grupo/[g]">): Promise<Metadata> {
  const { g } = await params;
  return { title: isGroup(g) ? `${GROUPS[g].label} · Satélites` : "Satélites" };
}

export default function Page({ params }: PageProps<"/satelites/grupo/[g]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/satelites/grupo/[g]">, "params">) {
  const { g } = await params;
  if (!isGroup(g)) notFound();
  const meta = GROUPS[g];
  const objs = await getGroup(g);

  const classes = (objs ?? []).reduce((m, o) => { const c = orbitClass(o); m[c] = (m[c] ?? 0) + 1; return m; }, {} as Record<string, number>);
  const newest = objs?.length ? [...objs].sort((a, b) => b.OBJECT_ID.localeCompare(a.OBJECT_ID))[0] : null;
  const avgInc = objs?.length ? objs.reduce((s, o) => s + o.INCLINATION, 0) / objs.length : null;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <nav className="flex items-center gap-1 text-xs text-fg-dim" aria-label="Ruta">
        <Link href="/satelites" className="hover:text-fg">Satélites</Link><ChevronRight className="size-3" /><span className="text-fg-muted">{meta.label}</span>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.label}</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">{meta.desc}</p>
      </header>

      {objs === null ? (
        <Card><Empty>CelesTrak no está disponible en este momento. Vuelve a intentarlo más tarde.</Empty></Card>
      ) : objs.length === 0 ? (
        <Card><Empty>Este grupo no tiene objetos en el catálogo ahora mismo.</Empty></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
            <Kpi label="Objetos" value={objs.length.toLocaleString("es")} />
            <Kpi label="Por órbita" value={<span className="text-base">{Object.entries(classes).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>} />
            <Kpi label="Inclinación media" value={avgInc === null ? "—" : `${avgInc.toLocaleString("es", { maximumFractionDigits: 1 })}°`} />
            <Kpi label="Más reciente" value={<span className="text-base">{newest?.OBJECT_ID ?? "—"}</span>} hint={newest?.OBJECT_NAME} />
          </div>
          <Card className="overflow-hidden"><ConstellationGlobe objects={objs} /></Card>
          <Card>
            <CardHeader title="Catálogo" meta="Clic en un objeto para ver su órbita, traza y pasos" />
            <SatTable objects={objs} />
          </Card>
        </>
      )}
    </div>
  );
}
