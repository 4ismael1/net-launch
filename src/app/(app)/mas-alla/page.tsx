import type { Metadata } from "next";
import { getProbes } from "@/lib/data/universe";
import { wikiEs } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, Empty } from "@/components/ui/Card";
import { ProbesView } from "@/components/space/ProbesView";

export const metadata: Metadata = { title: "Más allá de la órbita" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Más allá de la órbita"
        description="Dónde están ahora mismo las sondas que exploran el sistema solar, de la Parker Solar Probe rozando el Sol a las Voyager en el espacio interestelar. Distancias en vivo calculadas con efemérides de JPL Horizons." />
      <Streamed fallback={<div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]"><div className="aspect-square animate-pulse rounded-lg border border-line bg-surface" /><div className="h-96 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

async function Content() {
  const { probes, earth, at } = await getProbes();
  // Foto y resumen en español de cada sonda (Wikipedia ES, caché de semanas)
  const wiki = await Promise.all(probes.map((p) => wikiEs(p.wiki)));
  const info = Object.fromEntries(probes.map((p, i) => [p.id, wiki[i] ? { extract: wiki[i]!.extract, url: wiki[i]!.url, image: wiki[i]!.thumb ?? null } : null]));
  if (!probes.length) return <Card><Empty>JPL Horizons no respondió en este momento. Vuelve a intentarlo en unos minutos.</Empty></Card>;
  return <ProbesView probes={probes} earth={earth} at={at} info={info} />;
}
