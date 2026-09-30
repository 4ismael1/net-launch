import type { Metadata } from "next";
import { getLatestNews } from "@/lib/news";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Empty } from "@/components/ui/Card";
import { NewsGrid } from "@/components/news/NewsList";

export const metadata: Metadata = { title: "Noticias" };

export default async function Page() {
  const items = await getLatestNews();
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Información" title="Noticias"
        description="Últimas noticias del sector de medios especializados y agencias, agregadas por Spaceflight News API. Los titulares se muestran en su idioma original y enlazan a la fuente." />
      {items === null ? <Card><Empty>El servicio de noticias no está disponible en este momento.</Empty></Card> : <NewsGrid items={items} />}
    </div>
  );
}
