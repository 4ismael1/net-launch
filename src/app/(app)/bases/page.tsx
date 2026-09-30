import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Bases" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Bases" description="Bases espaciales y plataformas de lanzamiento del mundo." />
      <ComingSoon phase="F6" what="Bases espaciales y plataformas de lanzamiento del mundo." />
    </div>
  );
}
