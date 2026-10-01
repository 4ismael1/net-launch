import type { Metadata } from "next";
import { getGroup } from "@/lib/satellites";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { TonightView } from "@/components/space/TonightView";

export const metadata: Metadata = { title: "Esta noche" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Esta noche desde tu ubicación"
        description="Qué se puede ver en el cielo esta noche: horarios de Sol y Luna, planetas a simple vista y los pasos visibles de la Estación Espacial y otros satélites brillantes. Todo se calcula en tu navegador." />
      <Streamed fallback={<div className="h-[70vh] animate-pulse rounded-lg border border-line bg-surface" />}>
        <Content />
      </Streamed>
    </div>
  );
}

async function Content() {
  // Los ~100 objetos más brillantes (incluye la ISS y Tiangong). Caché de 3 h en el servidor.
  const sats = (await getGroup("visual")) ?? [];
  return <TonightView sats={sats} />;
}
