import type { Metadata } from "next";
import { Streamed } from "@/components/ui/Streamed";
import { Info } from "lucide-react";
import { CATEGORIES, FEATURED, GROUPS, type GroupKey } from "@/lib/satellites";
import { SatExplorer } from "@/components/orbit/SatExplorer";

export const metadata: Metadata = { title: "Satélites" };

export default function Page() {
  const groups = (Object.keys(GROUPS) as GroupKey[]).map((key) => ({ key, ...GROUPS[key] }));
  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Satélites en tiempo real</h1>
        <p className="text-sm text-fg-muted">Activa y combina grupos del catálogo público de CelesTrak y míralos moverse alrededor de la Tierra.</p>
      </div>
      <Streamed fallback={<div className="h-[70vh] animate-pulse rounded-lg border border-line bg-surface" />}>
        <SatExplorer groups={groups} categories={CATEGORIES} featured={FEATURED} />
      </Streamed>
      <p className="flex gap-2 text-xs text-fg-dim">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Fuente: CelesTrak (GP/SATCAT), descargado en el servidor como máximo una vez cada 3 h. Cada posición se recalcula con el modelo SGP4 aproximadamente cada segundo
        y, entre cálculos, avanza con la velocidad real del satélite. Son cálculos a partir de elementos orbitales publicados, no telemetría.
      </p>
    </div>
  );
}
