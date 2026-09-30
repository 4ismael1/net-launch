import type { Metadata } from "next";
import Link from "next/link";
import { Streamed } from "@/components/ui/Streamed";
import { AGENCY_TYPES, listOrganizations, typeLabel, type OrgSort } from "@/lib/data/entities";
import { PageHeader } from "@/components/ui/PageHeader";
import { UrlFilters } from "@/components/entity/UrlFilters";
import { Logo } from "@/components/entity/shared";
import { Flag } from "@/components/ui/Flag";
import { countryName } from "@/lib/format";

export const metadata: Metadata = { title: "Organizaciones" };

export default function Page({ searchParams }: PageProps<"/organizaciones">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Organizaciones"
        description="Agencias espaciales, empresas y consorcios con actividad de lanzamiento registrada. Ordenadas alfabéticamente por defecto: aquí nadie tiene prioridad por ser famoso." />
      <Streamed fallback={<div className="h-96 animate-pulse rounded-lg border border-line bg-surface" />}>
        <List searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/organizaciones">, "searchParams">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const rows = await listOrganizations({ q: s("q"), tipo: s("tipo"), pais: s("pais"), orden: s("orden") as OrgSort | undefined });
  const all = await listOrganizations({});
  const countries = [...new Set(all.flatMap((r) => r.country_codes ?? []))].sort((a, b) => (countryName(a) ?? a).localeCompare(countryName(b) ?? b, "es"));

  return (
    <>
      <UrlFilters count={rows.length} noun="organizaciones" fields={[
        { kind: "search", key: "q", placeholder: "Buscar organización…" },
        { kind: "segmented", key: "orden", options: [["", "A–Z"], ["activas", "Más activas"], ["menos", "Menos conocidas"]] },
        { kind: "select", key: "tipo", label: "Tipo", options: [["", "Todos los tipos"], ...Object.entries(AGENCY_TYPES)] },
        { kind: "select", key: "pais", label: "País", options: [["", "Todos los países"], ...countries.map((c) => [c, countryName(c) ?? c] as [string, string])] },
      ]} />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((o) => (
          <Link key={o.id} href={`/organizaciones/${o.id}`} className="flex items-center gap-3 bg-surface p-4 transition-colors hover:bg-surface-2">
            <Logo src={o.logo_url} alt={o.abbrev ?? o.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{o.name}</p>
              <p className="truncate text-xs text-fg-dim">
                {(o.country_codes ?? []).slice(0, 2).map((c) => <span key={c} className="mr-1.5"><Flag code={c} /> {countryName(c)}</span>)}
                {(o.country_codes?.length ?? 0) > 2 && `+${o.country_codes!.length - 2} `}
                · {typeLabel(o.type)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-sm">{(o.total ?? o.known).toLocaleString("es")}</p>
              <p className="text-[10.5px] text-fg-dim">{o.upcoming > 0 ? <span className="text-accent">{o.upcoming} {o.upcoming === 1 ? "próximo" : "próximos"}</span> : "lanzamientos"}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
