import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Box } from "lucide-react";
import { craftStatus, craftType, getSpacecraft } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { durLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Naves" };

export default function Page({ searchParams }: PageProps<"/naves">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Naves espaciales"
        description="Cápsulas y naves de carga que llevan personas y suministros: Dragon, Soyuz, Progress, Shenzhou, Cygnus, Orion… Cada unidad con sus vuelos y su tiempo en el espacio." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-96 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/naves">, "searchParams">) {
  const [{ items, groups }, sp] = await Promise.all([getSpacecraft(), searchParams]);
  if (!items.length) return <Card><Empty>El catálogo de naves se está descargando de LL2 poco a poco (respetando su límite de peticiones). Vuelve en unas horas.</Empty></Card>;
  const sel = Number(typeof sp.tipo === "string" ? sp.tipo : NaN);
  const group = groups.find((g) => g.id === sel) ?? null;
  const units = items
    .filter((s) => (group ? s.configId === group.id : s.inSpace))
    .sort((a, b) => Number(b.inSpace) - Number(a.inSpace) || b.flights - a.flights || b.timeInSpace - a.timeInSpace);
  const now = items.filter((s) => s.inSpace).length;
  const maxFlights = items.reduce((m, s) => (s.flights > m.flights ? s : m), items[0]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Unidades" value={items.length.toLocaleString("es")} hint={`${groups.length} modelos`} />
        <Kpi label="En el espacio ahora" value={now} />
        <Kpi label="Más reutilizada" value={maxFlights.flights} hint={`${maxFlights.name} · vuelos`} />
        <Kpi label="Tiempo total en órbita" value={durLabel(items.reduce((s, x) => s + x.timeInSpace, 0))} />
      </div>

      <Card>
        <CardHeader title="Modelos" meta="Elige uno para ver sus unidades" />
        <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:thin]">
          <Link href="/naves" scroll={false} className={clsx("flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors", !group ? "border-line-strong bg-surface-3 text-fg" : "border-line text-fg-muted hover:text-fg")}>
            <span className="size-1.5 rounded-full bg-accent" /> En el espacio <span className="num text-fg-dim">{now}</span>
          </Link>
          {groups.filter((g) => g.flights > 0).map((g) => (
            <Link key={g.id} href={`/naves?tipo=${g.id}`} scroll={false}
              className={clsx("flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors", group?.id === g.id ? "border-line-strong bg-surface-3 text-fg" : "border-line text-fg-muted hover:text-fg")}>
              {g.name} <span className="num text-fg-dim">{g.units}</span>{g.inSpace > 0 && <span className="size-1.5 rounded-full bg-accent" title={`${g.inSpace} en el espacio`} />}
            </Link>
          ))}
        </div>
      </Card>

      {group && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-5">
          <Kpi label="Modelo" value={<span className="text-xl">{group.name}</span>} hint={[craftType(group.type), group.agency].filter(Boolean).join(" · ")} />
          <Kpi label="Unidades" value={group.units} />
          <Kpi label="Vuelos" value={group.flights} hint={`Máx. ${group.maxFlights} por unidad`} />
          <Kpi label="Tiempo en órbita" value={durLabel(group.time)} />
          <Kpi label="Tripulación" value={group.humanRated ? group.crew ?? "Sí" : "Sin tripulación"} />
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {units.map((s) => (
          <li key={s.id} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-3">
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              ) : <Box className="absolute inset-0 m-auto size-5 text-fg-dim" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-[14px] font-medium">{s.name}</p>
              <p className="truncate text-xs text-fg-dim">{s.config}{s.serial && ` · ${s.serial}`}</p>
              <p className="mt-auto flex flex-wrap items-center gap-x-3 pt-1.5 text-xs text-fg-muted">
                {s.inSpace ? <span className="inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" /> En el espacio</span> : <span>{craftStatus(s.status) ?? "—"}</span>}
                <span><span className="num text-fg">{s.flights}</span> {s.flights === 1 ? "vuelo" : "vuelos"}</span>
                <span className="num">{durLabel(s.timeInSpace)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!units.length && <Card><Empty>{group ? "Sin unidades registradas." : "Ninguna nave registrada en el espacio ahora mismo."}</Empty></Card>}
    </div>
  );
}
