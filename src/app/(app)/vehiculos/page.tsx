import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Vehículos" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Vehículos" description="Cohetes y configuraciones con sus estadísticas." />
      <ComingSoon phase="F6" what="Cohetes y configuraciones con sus estadísticas." />
    </div>
  );
}
