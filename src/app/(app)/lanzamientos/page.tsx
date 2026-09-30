import type { Metadata } from "next";
import Link from "next/link";
import { Streamed } from "@/components/ui/Streamed";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFilterOptions, parseFilters, searchLaunches } from "@/lib/data/explore";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExploreFilters } from "@/components/explore/ExploreFilters";
import { LaunchTile } from "@/components/launch/LaunchTile";

export const metadata: Metadata = { title: "Lanzamientos" };

export default function LanzamientosPage({ searchParams }: PageProps<"/lanzamientos">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Explorador"
        title="Lanzamientos"
        description="Próximos y pasados de todo el mundo. Los filtros se combinan y quedan en la URL para compartir la búsqueda."
      />
      <Streamed fallback={<Skeleton />}>
        <Results searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/lanzamientos">, "searchParams">) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [{ rows, total, page, pages }, options] = await Promise.all([searchLaunches(f), getFilterOptions()]);

  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    q.set("page", String(p));
    return `/lanzamientos?${q}`;
  };

  return (
    <>
      <ExploreFilters options={options} total={total} />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface px-4 py-16 text-center text-sm text-fg-muted">
          Ningún lanzamiento coincide con estos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((l) => <LaunchTile key={l.id} l={l} />)}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Paginación">
          {page > 1 ? <Link href={href(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 hover:bg-surface-2"><ChevronLeft className="size-4" /> Anterior</Link> : <span />}
          <span className="num px-3 text-fg-muted">{page} / {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 hover:bg-surface-2">Siguiente <ChevronRight className="size-4" /></Link>}
        </nav>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-lg border border-line bg-surface" />)}
    </div>
  );
}
