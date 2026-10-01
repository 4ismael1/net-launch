import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Box } from "lucide-react";
import { craftStatus, craftType, getSpacecraft } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { durLabel } from "@/lib/format";
import { getInSpace } from "@/lib/data/space";
import { When } from "@/components/ui/When";

export const metadata: Metadata = {
  title: "Naves",
  description: "Cápsulas y naves de carga (Dragon, Soyuz, Progress, Shenzhou, Cygnus, Orion…): las acopladas ahora, cada unidad con sus vuelos y su tiempo en el espacio.",
};

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
  const [{ items, groups }, sp, space] = await Promise.all([getSpacecraft(), searchParams, getInSpace()]);
  // Acopladas ahora mismo a las estaciones (instantánea de "En el espacio")
  const docked = (space?.stations ?? []).flatMap((st) => st.ports.filter((pt) => pt.vehicle).map((pt) => ({ vehicle: pt.vehicle!, port: pt.name, since: pt.since, img: pt.image, station: /international/i.test(st.name) ? "Estación Espacial Internacional" : st.name.replace(/ space station$/i, ""), image: st.imageUrl })));
  const hero = docked.length > 0 && (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="label flex items-center gap-2 !text-fg-muted"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span> Acopladas ahora · <span className="num !text-fg">{docked.length}</span></h2>
        <Link href="/en-el-espacio" className="text-xs text-fg-muted hover:text-fg">Ver las estaciones →</Link>
      </header>
      <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {docked.map((d) => {
          const img = d.img ?? items.find((x) => x.inSpace && x.name === d.vehicle)?.image ?? d.image;
          return (
            <li key={d.vehicle + d.port} className="flex gap-3 bg-surface p-4">
              <span className="size-14 shrink-0 overflow-hidden rounded-md bg-surface-3">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.vehicle}</span>
                <span className="block truncate text-xs text-fg-muted">{d.station}</span>
                <span className="block truncate text-[11px] text-fg-dim">{d.port}{d.since && <> · acoplada desde <When at={d.since} withTime={false} /></>}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
  if (!items.length) return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {hero}
      <Card><Empty>El catálogo histórico de naves (récords, modelos y vuelos) estará disponible próximamente.{hero ? " Mientras tanto, arriba puedes ver las naves acopladas ahora mismo a las estaciones." : ""}</Empty></Card>
    </div>
  );
  // "En el espacio": el catálogo es semanal; las acopladas de la instantánea (cada 3 h) cuentan siempre
  const dockedNames = new Set(docked.map((x) => x.vehicle));
  const up = (s: (typeof items)[number]) => s.inSpace || dockedNames.has(s.name);
  const sel = Number(typeof sp.tipo === "string" ? sp.tipo : NaN);
  const group = groups.find((g) => g.id === sel) ?? null;
  const units = items
    .filter((s) => (group ? s.configId === group.id : up(s)))
    .sort((a, b) => Number(up(b)) - Number(up(a)) || b.flights - a.flights || b.timeInSpace - a.timeInSpace);
  const now = items.filter(up).length;
  const maxFlights = items.reduce((m, s) => (s.flights > m.flights ? s : m), items[0]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {hero}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Unidades" value={items.length.toLocaleString("es")} hint={`${groups.length} modelos`} />
        <Kpi label="En el espacio ahora" value={now} />
        <Kpi label="Más reutilizada" value={maxFlights.flights} hint={`vuelos · ${maxFlights.name}`} />
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
                {up(s) ? <span className="inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" /> En el espacio</span> : <span>{craftStatus(s.status) ?? "—"}</span>}
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
