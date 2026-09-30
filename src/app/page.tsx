import type { Metadata } from "next";
import { getLandingData } from "@/lib/data/landing";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: { absolute: "NET · Monitor mundial de lanzamientos espaciales" },
};

// Portada narrativa: todo lo que se ve (globo, cifras, recorrido) sale de datos reales.
export default async function Page() {
  const data = await getLandingData();
  return <Landing data={data} />;
}
