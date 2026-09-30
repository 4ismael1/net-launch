import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "En el espacio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="En el espacio" description="Astronautas en órbita ahora y estaciones espaciales, con la posición calculada de la ISS y Tiangong." />
      <ComingSoon phase="F6" what="Astronautas en órbita ahora y estaciones espaciales, con la posición calculada de la ISS y Tiangong." />
    </div>
  );
}
