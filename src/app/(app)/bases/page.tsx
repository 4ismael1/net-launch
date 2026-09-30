import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { listLocations } from "@/lib/data/entities";
import { PageHeader } from "@/components/ui/PageHeader";
import { Flag } from "@/components/ui/Flag";
import { countryName } from "@/lib/format";

export const metadata: Metadata = { title: "Bases" };

export default async function Page() {
  const rows = await listLocations();
  const byCountry = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.country_code ?? "—";
    byCountry.set(k, [...(byCountry.get(k) ?? []), r]);
  }
  const groups = [...byCountry.entries()].sort((a, b) => b[1].reduce((s, r) => s + r.total, 0) - a[1].reduce((s, r) => s + r.total, 0));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Bases espaciales"
        description={`${rows.length} bases con actividad registrada en ${groups.length} países, agrupadas por país. Cada base reúne una o varias plataformas de lanzamiento.`}
        actions={<Link href="/mapa" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2"><MapPin className="size-4" /> Ver en el mapa</Link>} />
      <div className="space-y-6">
        {groups.map(([code, list]) => (
          <section key={code}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-muted"><Flag code={code} /> {countryName(code) ?? "Sin país"} <span className="num text-xs text-fg-dim">{list.length}</span></h2>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
              {list.map((b) => (
                <Link key={b.id} href={`/bases/${b.id}`} className="flex items-center justify-between gap-3 bg-surface p-4 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{b.name}</p>
                    <p className="text-xs text-fg-dim">{b.pads} plataforma{b.pads === 1 ? "" : "s"}{b.lat != null && b.lng != null && <span className="num"> · {b.lat.toFixed(2)}°, {b.lng.toFixed(2)}°</span>}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm">{b.total.toLocaleString("es")}</p>
                    <p className="text-[10.5px] text-fg-dim">{b.upcoming > 0 ? <span className="text-accent">{b.upcoming} {b.upcoming === 1 ? "próximo" : "próximos"}</span> : b.recent > 0 ? `${b.recent} en 12 meses` : "lanzamientos"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
