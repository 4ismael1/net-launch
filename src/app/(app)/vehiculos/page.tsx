import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Rocket } from "lucide-react";
import { listRockets } from "@/lib/data/entities";
import { PageHeader } from "@/components/ui/PageHeader";
import { UrlFilters } from "@/components/entity/UrlFilters";
import { Flag } from "@/components/ui/Flag";

export const metadata: Metadata = { title: "Vehículos" };

export default function Page({ searchParams }: PageProps<"/vehiculos">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Vehículos de lanzamiento" description="Cohetes y sus configuraciones, con historial y tasa de éxito." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-line bg-surface" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/vehiculos">, "searchParams">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const estado = s("estado") === "activos" || s("estado") === "retirados" ? (s("estado") as "activos" | "retirados") : undefined;
  const rows = await listRockets({ q: s("q"), estado });
  return (
    <>
      <UrlFilters count={rows.length} noun="vehículos" fields={[
        { kind: "search", key: "q", placeholder: "Buscar cohete o familia…" },
        { kind: "segmented", key: "estado", options: [["", "Todos"], ["activos", "Activos"], ["retirados", "Retirados"]] },
      ]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => {
          const rate = r.total && r.success != null ? Math.round((r.success / r.total) * 100) : null;
          return (
            <Link key={r.id} href={`/vehiculos/${r.id}`} className="group flex gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong">
              <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-3">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" loading="lazy" className="size-full object-cover" />
                ) : <Rocket className="size-5 text-fg-dim" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[14px] font-medium">{r.full_name ?? r.name}</p>
                <p className="truncate text-xs text-fg-dim">{r.country_codes?.[0] && <Flag code={r.country_codes[0]} />} {r.manufacturer ?? "—"}</p>
                <div className="mt-auto flex items-end justify-between gap-2 text-xs">
                  <span className="text-fg-muted"><span className="num text-fg">{r.total ?? 0}</span> vuelos{rate !== null && <> · <span className="num">{rate} %</span> éxito</>}</span>
                  {r.upcoming > 0 ? <span className="num text-accent">{r.upcoming} próx.</span> : r.active === false && <span className="text-fg-dim">Retirado</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
