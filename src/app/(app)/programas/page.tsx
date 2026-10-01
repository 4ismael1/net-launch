import type { Metadata } from "next";
import Link from "next/link";
import { listPrograms, programType, type Program } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, Empty } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Programas" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Programas espaciales"
        description="Artemis, Commercial Crew, Starlink, Tiangong… Los grandes programas que agrupan misiones, con su actividad, próximos vuelos y organizaciones participantes." />
      <Streamed fallback={<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-lg border border-line bg-surface" />)}</div>}>
        <List />
      </Streamed>
    </div>
  );
}

const year = (d: string | null) => (d ? new Date(d).getUTCFullYear() : null);
const isActive = (p: Program) => !p.end || p.upcoming > 0;

async function List() {
  const rows = await listPrograms();
  if (!rows.length) return <Card><Empty>Los programas se cargarán en la próxima sincronización.</Empty></Card>;
  const active = rows.filter(isActive);
  const past = rows.filter((p) => !isActive(p));
  return (
    <div className="grid gap-8">
      <Section title="En curso" rows={active} />
      {past.length > 0 && <Section title="Finalizados" rows={past} />}
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Program[] }) {
  return (
    <section>
      <h2 className="label mb-3 !text-fg-muted">{title} <span className="num ml-1 text-fg-dim">{rows.length}</span></h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <Link key={p.id} href={`/programas/${p.id}`}
            className="group relative flex min-h-44 flex-col overflow-hidden rounded-lg border border-line bg-surface p-4 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong">
            {p.imageBig && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageBig} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-[0.18] transition-[opacity,transform] duration-700 group-hover:scale-[1.03] group-hover:opacity-25" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/85 to-surface/30" />
              </>
            )}
            <div className="relative flex flex-1 flex-col">
              <p className="label">{programType(p.type) ?? "Programa"}{year(p.start) && <> · {year(p.start)}{p.end ? `–${year(p.end)}` : "–hoy"}</>}</p>
              <h3 className="mt-1 text-[17px] font-semibold leading-snug">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{p.agencies.map((a) => a.abbrev ?? a.name).join(" · ") || " "}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-4 text-xs">
                <span className="text-fg-muted"><span className="num text-base text-fg">{p.launches}</span> lanzamientos</span>
                {p.upcoming > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" /> <span className="num">{p.upcoming}</span> próximos</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
