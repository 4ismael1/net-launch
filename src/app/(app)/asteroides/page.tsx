import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getApproaches, type Approach } from "@/lib/data/universe";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { When } from "@/components/ui/When";
import { ApproachChart } from "@/components/charts/ApproachChart";
import { ApproachExplorer } from "@/components/space/ApproachExplorer";
import { sizeLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Asteroides cercanos" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Asteroides que pasan cerca"
        description="Acercamientos a la Tierra de asteroides y cometas en los últimos 30 días y los próximos 60, a menos de 0,05 ua (≈ 19 distancias lunares). Datos del Center for Near-Earth Object Studies de la NASA/JPL." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-80 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

const ld = (v: number) => v.toLocaleString("es", { maximumFractionDigits: v < 1 ? 2 : 1 });
const sbdb = (des: string) => `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(des)}`;
const clean = (n: string) => n.replace(/^\((.*)\)$/, "$1");

function Rows({ rows, past }: { rows: Approach[]; past?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="label text-left">
            <th className="px-4 py-2 font-normal">Objeto</th><th className="px-2 py-2 font-normal">{past ? "Pasó" : "Pasará"}</th>
            <th className="px-2 py-2 text-right font-normal">Distancia</th><th className="px-2 py-2 text-right font-normal">Velocidad</th><th className="px-4 py-2 text-right font-normal">Tamaño</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.des + r.date} className="transition-colors hover:bg-surface-2">
              <td className="px-4 py-2"><a href={sbdb(r.des)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">{clean(r.name)} <ExternalLink className="size-3 text-fg-dim" /></a></td>
              <td className="px-2 py-2 text-xs text-fg-muted"><When at={r.date} /></td>
              <td className="num px-2 py-2 text-right">{ld(r.distLd)} <span className="text-fg-dim">DL</span><span className="block text-[11px] text-fg-dim">{Math.round(r.distKm).toLocaleString("es")} km</span></td>
              <td className="num px-2 py-2 text-right">{r.vRel.toLocaleString("es", { maximumFractionDigits: 1 })} <span className="text-fg-dim">km/s</span></td>
              <td className="num px-4 py-2 text-right text-fg-muted">{sizeLabel(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Content() {
  const { near, big, at } = await getApproaches();
  if (!near.length && !big.length) return <Card><Empty>No se pudo consultar a JPL en este momento. Vuelve a intentarlo en unos minutos.</Empty></Card>;
  const upcoming = near.filter((r) => Date.parse(r.date) >= at);
  const past = near.filter((r) => Date.parse(r.date) < at).reverse();
  const closest = [...upcoming].sort((a, b) => a.distLd - b.distLd)[0];
  const fastest = [...upcoming].sort((a, b) => b.vRel - a.vRel)[0];
  const inside = upcoming.filter((r) => r.distLd < 1).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Próximos 60 días" value={upcoming.length} hint="Acercamientos < 0,05 ua" />
        <Kpi label="Más cerca que la Luna" value={inside} hint="En los próximos 60 días" />
        <Kpi label="El más cercano" value={closest ? `${ld(closest.distLd)} DL` : "—"} hint={closest ? clean(closest.name) : undefined} />
        <Kpi label="El más rápido" value={fastest ? `${fastest.vRel.toLocaleString("es", { maximumFractionDigits: 1 })} km/s` : "—"} hint={fastest ? clean(fastest.name) : undefined} />
      </div>

      <ApproachExplorer rows={near} at={at} />

      <Card>
        <CardHeader title="Línea de tiempo" meta="Últimos 30 días y próximos 60 · escala logarítmica · DL = distancia Tierra–Luna (384 400 km)" />
        <div className="p-3"><ApproachChart rows={near} at={at} /></div>
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Cada punto es un acercamiento; su tamaño refleja el diámetro estimado. Gris: ya pasó.</p>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Los grandes del próximo año" meta="> ~140 m · < 0,2 ua" />
          {big.length ? <Rows rows={big} /> : <Empty>Ninguno en el próximo año.</Empty>}
        </Card>
        <Card>
          <CardHeader title="Últimos 30 días" />
          {past.length ? <Rows rows={past.slice(0, 15)} past /> : <Empty>Sin acercamientos recientes.</Empty>}
        </Card>
      </div>

      <p className="text-[11px] text-fg-dim">Un acercamiento no implica riesgo de impacto (la NASA evalúa los riesgos en su sistema Sentry). Tamaño estimado con la magnitud absoluta H y un albedo de 0,05–0,25 cuando no hay diámetro medido. Fuente: JPL SBDB Close-Approach Data API, actualizado cada 3 h.</p>
    </div>
  );
}
