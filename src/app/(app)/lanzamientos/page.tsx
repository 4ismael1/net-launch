import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Lanzamientos" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Lanzamientos" description="Explorador con búsqueda y filtros combinables por operador, país, cohete, estado y fecha." />
      <ComingSoon phase="F5" what="Explorador con búsqueda y filtros combinables por operador, país, cohete, estado y fecha." />
    </div>
  );
}
