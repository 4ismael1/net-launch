import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { listPrograms, programType, type Program } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, Empty } from "@/components/ui/Card";
import { Ticker } from "@/components/ui/Ticker";

export const metadata: Metadata = { title: "Programas" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Datos" title="Programas espaciales"
        description="Artemis, Commercial Crew, Starlink, Tiangong… Los grandes programas que agrupan misiones: su historia, su actividad y sus próximos vuelos." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-72 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-96 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
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
  const featured = rows.filter((p) => p.next).sort((a, b) => Date.parse(a.next!) - Date.parse(b.next!)).slice(0, 3);
  const active = rows.filter(isActive);
  const past = rows.filter((p) => !isActive(p));
  return (
    <div className="grid gap-8">
      {featured.length > 0 && (
        <section>
          <h2 className="label mb-3 !text-fg-muted">Próximos vuelos de programa</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Link key={p.id} href={`/programas/${p.id}`}
                className={clsx("group relative flex flex-col justify-end overflow-hidden rounded-lg border border-line bg-surface p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong", i === 0 ? "min-h-72 lg:col-span-1" : "min-h-72")}>
                {p.imageBig && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageBig} alt="" decoding="async" className="absolute inset-0 size-full object-cover opacity-40 transition-[opacity,transform] duration-700 group-hover:scale-[1.04] group-hover:opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/10" />
                  </>
                )}
                <div className="relative">
                  <p className="label">{programType(p.type) ?? "Programa"}</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">{p.name}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-fg-muted">{p.agencies.map((a) => a.abbrev ?? a.name).join(" · ")}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <Ticker at={p.next!} className="text-xl" />
                    <span className="text-xs text-fg-muted"><span className="num text-fg">{p.upcoming}</span> próximos</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Timeline rows={rows} />

      <Section title="En curso" rows={active} />
      {past.length > 0 && <Section title="Finalizados" rows={past} />}
    </div>
  );
}

/** Cronología: cada programa como una barra desde su inicio hasta su fin (o hoy). */
function Timeline({ rows }: { rows: Program[] }) {
  const items = rows.filter((p) => p.start).sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
  if (!items.length) return null;
  // "Hoy" según los datos (último lanzamiento registrado): el componente se prerenderiza y no puede leer el reloj
  const today = Math.max(...rows.map((p) => (p.last ? Date.parse(p.last) : 0)));
  const y0 = Math.min(...items.map((p) => year(p.start)!)), y1 = new Date(today).getUTCFullYear() + 1;
  const span = y1 - y0;
  const pos = (d: string | null) => ((Math.min(d ? Date.parse(d) : today, today) - Date.UTC(y0, 0, 1)) / (Date.UTC(y1, 0, 1) - Date.UTC(y0, 0, 1))) * 100;
  const decades = Array.from({ length: Math.floor(span / 10) + 1 }, (_, i) => Math.ceil(y0 / 10) * 10 + i * 10).filter((y) => y <= y1);
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="label !text-fg-muted">Seis décadas de programas</h2>
        <span className="flex items-center gap-4 text-[11px] text-fg-muted">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-accent" /> En curso</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg-muted/60" /> Finalizado</span>
        </span>
      </header>
      <div className="overflow-x-auto">
        <div className="relative min-w-[720px] px-4 py-3">
          <div className="pointer-events-none absolute inset-y-0 right-4 left-[13rem]">
            {decades.map((d) => (
              <span key={d} className="absolute inset-y-0 border-l border-line" style={{ left: `${((d - y0) / span) * 100}%` }}>
                <span className="num absolute top-0 left-1 text-[10px] text-fg-dim">{d}</span>
              </span>
            ))}
          </div>
          <ul className="relative mt-5 grid gap-0.5">
            {items.map((p) => {
              const a = pos(p.start), b = Math.max(a + 0.6, pos(p.end));
              const on = isActive(p);
              return (
                <li key={p.id}>
                  <Link href={`/programas/${p.id}`} className="group grid grid-cols-[12.5rem_minmax(0,1fr)] items-center gap-2 rounded py-[3px] hover:bg-surface-2" title={`${p.name} · ${year(p.start)}–${p.end ? year(p.end) : "hoy"} · ${p.launches} lanzamientos`}>
                    <span className="truncate pl-1 text-xs text-fg-muted group-hover:text-fg">{p.name}</span>
                    <span className="relative h-2.5">
                      <span className={clsx("absolute inset-y-0 rounded-full transition-colors", on ? "bg-accent group-hover:bg-[#ff7a45]" : "bg-fg-muted/50 group-hover:bg-fg-muted")} style={{ left: `${a}%`, width: `${b - a}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
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
                {p.upcoming > 0 && <span className="inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" /> <span className="num">{p.upcoming}</span> próximos</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
