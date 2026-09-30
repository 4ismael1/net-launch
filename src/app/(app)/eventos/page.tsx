import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Eventos" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Eventos" description="Acoplamientos, caminatas espaciales y otros eventos de Launch Library 2." />
      <ComingSoon phase="F6" what="Acoplamientos, caminatas espaciales y otros eventos de Launch Library 2." />
    </div>
  );
}
