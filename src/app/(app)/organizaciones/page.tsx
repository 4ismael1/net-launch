import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Organizaciones" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Organizaciones" description="Agencias y empresas de todo el mundo, incluidas las menos conocidas." />
      <ComingSoon phase="F6" what="Agencias y empresas de todo el mundo, incluidas las menos conocidas." />
    </div>
  );
}
