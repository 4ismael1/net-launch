import type { Metadata } from "next";
import { Suspense } from "react";
import { getMapData } from "@/lib/data/map";
import { WorldMap } from "@/components/map/WorldMap";

export const metadata: Metadata = { title: "Mapa" };

export default async function MapaPage() {
  const { pads, operators } = await getMapData();
  return (
    <div data-fullbleed className="-mx-4 -mt-5 -mb-24 md:-mx-6 md:-mb-10">
      <h1 className="sr-only">Mapa mundial de plataformas de lanzamiento</h1>
      <Suspense fallback={<div className="h-[calc(100dvh-56px)] bg-bg" />}>
        <WorldMap pads={pads} operators={operators} />
      </Suspense>
    </div>
  );
}
