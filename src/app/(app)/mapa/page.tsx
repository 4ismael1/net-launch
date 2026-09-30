import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Mapa" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Mapa" description="Mapa mundial interactivo con bases, plataformas, agrupación, filtros, vista satélite y globo." />
      <ComingSoon phase="F3" what="Mapa mundial interactivo con bases, plataformas, agrupación, filtros, vista satélite y globo." />
    </div>
  );
}
