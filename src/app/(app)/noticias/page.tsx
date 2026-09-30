import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getLatestNews } from "@/lib/news";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Empty } from "@/components/ui/Card";
import { NewsGrid } from "@/components/news/NewsList";

export const metadata: Metadata = { title: "Noticias" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Información" title="Noticias"
        description="Últimas noticias del sector de medios especializados y agencias, agregadas por Spaceflight News API. Los titulares se muestran en su idioma original y enlazan a la fuente." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-line bg-surface" />}><News /></Suspense>
    </div>
  );
}

async function News() {
  await connection(); // al visitar: titulares actuales
  const items = await getLatestNews();
  return items === null ? <Card><Empty>El servicio de noticias no está disponible en este momento.</Empty></Card> : <NewsGrid items={items} />;
}
