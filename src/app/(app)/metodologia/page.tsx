import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Metodología" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Metodología" description="Fuentes, frecuencia de actualización, limitaciones y glosario." />
      <ComingSoon phase="F11" what="Fuentes, frecuencia de actualización, limitaciones y glosario." />
    </div>
  );
}
