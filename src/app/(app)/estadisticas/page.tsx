import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Estadísticas" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Estadísticas" description="Lanzamientos por año, país, operador, vehículo y el índice de concentración." />
      <ComingSoon phase="F7" what="Lanzamientos por año, país, operador, vehículo y el índice de concentración." />
    </div>
  );
}
