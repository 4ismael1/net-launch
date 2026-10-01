import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Streamed } from "@/components/ui/Streamed";
import { ChevronRight, ExternalLink, Info } from "lucide-react";
import { getLaunchDetail } from "@/lib/data/launch-detail";
import { getRecent } from "@/lib/data/launches";
import { derived, getLaunchObjects, orbitClass } from "@/lib/orbit";
import { Card, CardHeader, Empty } from "@/components/ui/Card";
import { OrbitViewer } from "@/components/orbit/OrbitViewer";
import { LocalTime } from "@/components/launch/LocalTime";

export async function generateStaticParams() {
  const slugs = (await getRecent(6)).map((l) => ({ slug: l.slug }));
  return slugs.length ? slugs : [{ slug: "sin-lanzamientos" }]; // Next exige al menos uno
}

export async function generateMetadata({ params }: PageProps<"/orbita/[slug]">): Promise<Metadata> {
  const d = await getLaunchDetail((await params).slug);
  if (!d) return { title: "Lanzamiento no encontrado" };
  return { title: `Órbita · ${d.l.name}`, description: `Objetos catalogados tras el lanzamiento ${d.l.name}, con su órbita calculada (SGP4) a partir de elementos orbitales públicos de CelesTrak.` };
}

export default function Page({ params }: PageProps<"/orbita/[slug]">) {
  return (
    <Streamed fallback={<div className="mx-auto h-[60vh] max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <Content params={params} />
    </Streamed>
  );
}

const nf = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d });

async function Content({ params }: Pick<PageProps<"/orbita/[slug]">, "params">) {
  const { slug } = await params;
  const d = await getLaunchDetail(slug);
  if (!d) notFound();
  const des = d.l.launchDesignator;
  const objects = des ? await getLaunchObjects(des) : [];

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <nav className="flex items-center gap-1 text-xs text-fg-dim" aria-label="Ruta">
        <Link href={`/lanzamientos/${slug}`} className="hover:text-fg">{d.l.name}</Link>
        <ChevronRight className="size-3" />
        <span className="text-fg-muted">Objetos en órbita</span>
      </nav>

      <header className="rounded-lg border border-line bg-surface p-5">
        <p className="label mb-1">Seguimiento orbital · COSPAR {des ?? "—"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Objetos catalogados del lanzamiento</h1>
        <p className="mt-2 flex max-w-3xl gap-2 text-sm text-fg-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-dim" />
          <span>El lanzamiento y los objetos en órbita son cosas distintas: esta vista muestra cargas útiles y otros objetos catalogados públicamente <em>después</em> del lanzamiento.
          Sus posiciones se calculan con el modelo SGP4 a partir de los elementos orbitales; no son datos de telemetría.</span>
        </p>
      </header>

      {!des ? (
        <Card><Empty>Este lanzamiento no tiene designador COSPAR: aún no ha despegado o no alcanzó la órbita, así que no hay objetos que seguir.</Empty></Card>
      ) : objects === null ? (
        <Card><Empty>CelesTrak no está disponible en este momento. El resto de la misión sigue accesible.</Empty></Card>
      ) : objects.length === 0 ? (
        <Card><Empty>Todavía no hay objetos catalogados públicamente para este lanzamiento (el catálogo suele tardar horas o días).</Empty></Card>
      ) : (
        <>
          <Card className="overflow-hidden"><OrbitViewer objects={objects} /></Card>
          <Card>
            <CardHeader title="Objetos" meta={`${objects.length}${objects.length > 12 ? " · se dibujan los 12 primeros" : ""}`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-2 text-left"><tr>
                  {["Nombre", "NORAD", "Órbita", "Perigeo", "Apogeo", "Inclinación", "Periodo", "Época de los elementos"].map((h) => <th key={h} className="label px-4 py-2 font-normal">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {objects.map((o) => {
                    const x = derived(o);
                    return (
                      <tr key={o.NORAD_CAT_ID}>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Link href={`/satelites/${o.NORAD_CAT_ID}`} className="hover:underline">{o.OBJECT_NAME}</Link>
                            <a href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${o.NORAD_CAT_ID}`} target="_blank" rel="noopener noreferrer" aria-label={`${o.OBJECT_NAME} en CelesTrak`} className="text-fg-dim hover:text-fg"><ExternalLink className="size-3" /></a>
                          </span>
                        </td>
                        <td className="num px-4 py-2 text-fg-muted">{o.NORAD_CAT_ID}</td>
                        <td className="num px-4 py-2">{orbitClass(o)}</td>
                        <td className="num px-4 py-2 text-fg-muted">{nf(x.perigeeKm)} km</td>
                        <td className="num px-4 py-2 text-fg-muted">{nf(x.apogeeKm)} km</td>
                        <td className="num px-4 py-2 text-fg-muted">{nf(o.INCLINATION, 2)}°</td>
                        <td className="num px-4 py-2 text-fg-muted">{nf(x.periodMin, 1)} min</td>
                        <td className="px-4 py-2 text-xs text-fg-dim"><LocalTime date={`${o.EPOCH}Z`} mode="relative" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Fuente: CelesTrak (GP, formato OMM). Perigeo/apogeo aproximados a partir del movimiento medio.</p>
          </Card>
        </>
      )}
    </div>
  );
}
