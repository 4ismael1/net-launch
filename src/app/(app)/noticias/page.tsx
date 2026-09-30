import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Noticias" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Noticias" description="Noticias vinculadas a lanzamientos (Spaceflight News API)." />
      <ComingSoon phase="F11" what="Noticias vinculadas a lanzamientos (Spaceflight News API)." />
    </div>
  );
}
