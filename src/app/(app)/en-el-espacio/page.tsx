import type { Metadata } from "next";
import { getInSpace } from "@/lib/data/space";
import { getStationsGP } from "@/lib/orbit";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Empty } from "@/components/ui/Card";
import { Streamed } from "@/components/ui/Streamed";
import { InSpace } from "@/components/space/InSpace";

export const metadata: Metadata = {
  title: "En el espacio",
  description: "Quién está en órbita ahora, en qué estación y por dónde pasa, con posiciones calculadas (SGP4) a partir de elementos orbitales públicos.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Explorar" title="En el espacio ahora"
        description="Quién está en órbita, en qué estación, qué hace allí y por dónde pasa ahora mismo. Posiciones calculadas en tu navegador a partir de elementos orbitales públicos." />
      <Streamed fallback={<div className="h-[70vh] animate-pulse rounded-lg border border-line bg-surface" />}>
        <Content />
      </Streamed>
    </div>
  );
}

async function Content() {
  // Servida desde caché y renovada en segundo plano: la visita no espera a CelesTrak ni a la BD
  const [data, gp] = await Promise.all([getInSpace(), getStationsGP()]);
  if (!data) return <Card><Empty>Los datos se cargarán en la próxima sincronización.</Empty></Card>;
  return <InSpace stations={data.stations} astronauts={data.astronauts} gp={gp} at={data.at} />;
}
