import type { Metadata } from "next";
import { Streamed } from "@/components/ui/Streamed";
import { getMapData } from "@/lib/data/map";
import { WorldMap } from "@/components/map/WorldMap";
import { HtmlFlag } from "@/components/ui/HtmlFlag";

export const metadata: Metadata = {
  title: "Mapa",
  description: "Mapa mundial de plataformas de lanzamiento con filtros por país y operador, vista de globo y próximos lanzamientos de cada base.",
};

export default async function MapaPage() {
  const { pads, operators } = await getMapData();
  return (
    <div data-fullbleed className="-mx-4 -mt-5 -mb-8 md:-mx-6 md:-mb-10">
      <HtmlFlag name="fullbleed" />
      <h1 className="sr-only">Mapa mundial de plataformas de lanzamiento</h1>
      <Streamed fallback={<div className="h-[calc(100dvh-56px-4rem-env(safe-area-inset-bottom))] bg-bg md:h-[calc(100dvh-56px)]" />}>
        <WorldMap pads={pads} operators={operators} />
      </Streamed>
    </div>
  );
}
