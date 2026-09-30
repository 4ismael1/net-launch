import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getNews, getNewsSites, NEWS_PAGE } from "@/lib/news";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Empty } from "@/components/ui/Card";
import { Streamed } from "@/components/ui/Streamed";
import { UrlFilters } from "@/components/entity/UrlFilters";
import { NewsGrid } from "@/components/news/NewsList";

export const metadata: Metadata = { title: "Noticias" };

export default function Page({ searchParams }: PageProps<"/noticias">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Información" title="Noticias"
        description="Noticias de medios especializados y agencias, agregadas por Spaceflight News API. Los titulares se muestran en su idioma original y enlazan a la fuente." />
      <Streamed fallback={<Skeleton />}>
        <News searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

async function News({ searchParams }: Pick<PageProps<"/noticias">, "searchParams">) {
  await connection(); // al visitar: titulares actuales
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string).slice(0, 80) : undefined);
  const page = Math.max(1, Number(str("page")) || 1);
  const [res, sites] = await Promise.all([getNews({ q: str("q"), site: str("medio"), page }), getNewsSites()]);
  const pages = res ? Math.max(1, Math.ceil(res.count / NEWS_PAGE)) : 1;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    q.set("page", String(p));
    return `/noticias?${q}`;
  };

  return (
    <>
      <UrlFilters count={res?.count ?? 0} noun="noticias" fields={[
        { kind: "search", key: "q", placeholder: "Buscar en titulares y resúmenes (en inglés): Starship, Artemis, ISRO…" },
        { kind: "select", key: "medio", label: "Medio", options: [["", "Todos los medios"], ...sites.map((s) => [s, s] as [string, string])] },
      ]} />
      {res === null ? (
        <Card><Empty>El servicio de noticias no está disponible en este momento.</Empty></Card>
      ) : res.items.length === 0 ? (
        <Card><Empty>No hay noticias que coincidan con la búsqueda.</Empty></Card>
      ) : (
        <NewsGrid items={res.items} />
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Paginación">
          {page > 1 ? <Link href={href(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 hover:bg-surface-2"><ChevronLeft className="size-4" /> Anteriores</Link> : <span />}
          <span className="num px-3 text-fg-muted">{page.toLocaleString("es")} / {pages.toLocaleString("es")}</span>
          {page < pages && <Link href={href(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 hover:bg-surface-2">Siguientes <ChevronRight className="size-4" /></Link>}
        </nav>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-lg border border-line bg-surface" />)}
    </div>
  );
}
