import type { Metadata } from "next";
import Link from "next/link";
import { getSatcat } from "@/lib/data/universe";
import { CENTER_NAME, OBJ_LABEL, OBJ_TYPES, OWNER_NAME, TYPE_COLORS, type Regime } from "@/lib/satcat";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { PopulationChart } from "@/components/charts/UniverseCharts";

export const metadata: Metadata = { title: "Población orbital" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Población orbital y basura espacial"
        description="Todo lo que la humanidad ha puesto en órbita desde el Sputnik: satélites activos, etapas de cohete abandonadas y fragmentos. Catálogo público SATCAT de CelesTrak, actualizado cada semana." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-80 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

const nf = (n: number) => n.toLocaleString("es");
const REGIME: [Regime, string, string][] = [
  ["LEO", "Órbita baja", "< 2 000 km"],
  ["MEO", "Órbita media", "2 000–35 000 km · GPS, Galileo"],
  ["GEO", "Geoestacionaria", "≈ 35 786 km"],
  ["HEO", "Muy elíptica", "Molniya, transferencias"],
];

async function Content() {
  const s = await getSatcat();
  if (!s) return <Card><Empty>El catálogo se descargará en la próxima sincronización.</Empty></Card>;
  const junk = s.byType["R/B"] + s.byType.DEB + s.byType.UNK;
  const regMax = Math.max(...REGIME.map(([r]) => s.byRegime[r]), 1);
  const ownMax = s.owners[0]?.total ?? 1;
  const last = s.years.at(-1);
  const prev = s.years.at(-2);
  const updated = new Date(s.at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="En órbita terrestre" value={nf(s.onOrbit)} hint="Objetos catalogados ahora" />
        <Kpi label="Satélites operativos" value={nf(s.active)} hint={`${Math.round((s.active / s.onOrbit) * 100)} % de lo que hay en órbita`} />
        <Kpi label="Basura espacial" value={nf(junk)} hint="Etapas, fragmentos y sin identificar" />
        <Kpi label="Ya reentraron" value={nf(s.decayed)} hint={`De ${nf(s.total)} catalogados desde 1957`} />
      </div>

      <Card>
        <CardHeader title="Objetos en órbita a lo largo del tiempo" meta={last && prev ? `${nf(last.launched)} catalogados este año · ${nf(last.decayed)} reentradas` : undefined} />
        <div className="p-3 pt-4"><PopulationChart years={s.years} /></div>
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Población a fin de cada año (el último, hasta hoy). Los saltos de fragmentos corresponden a explosiones y colisiones (p. ej. 2007 Fengyun-1C, 2009 Iridium–Cosmos, 2021 Cosmos 1408).</p>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Qué hay en órbita" />
          <div className="p-4">
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
              {OBJ_TYPES.map((t) => <span key={t} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.byType[t] / s.onOrbit) * 100}%`, background: TYPE_COLORS[t] }} title={`${OBJ_LABEL[t]}: ${nf(s.byType[t])}`} />)}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {OBJ_TYPES.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: TYPE_COLORS[t] }} />
                  <span><span className="num text-base">{nf(s.byType[t])}</span><span className="block text-xs text-fg-muted">{OBJ_LABEL[t]} · {Math.round((s.byType[t] / s.onOrbit) * 100)} %</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Por región orbital" meta="Todos · operativos" />
          <ul className="grid gap-3 p-4">
            {REGIME.map(([r, name, hint]) => (
              <li key={r} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="min-w-0"><span className="block truncate">{name}</span><span className="block truncate text-[11px] text-fg-dim">{hint}</span></span>
                <span className="relative h-4 overflow-hidden rounded-[3px] bg-surface-2">
                  <span className="absolute inset-y-0 left-0 rounded-[3px] bg-fg-muted/40" style={{ width: `${(s.byRegime[r] / regMax) * 100}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded-[3px] bg-accent" style={{ width: `${(s.activeByRegime[r] / regMax) * 100}%` }} />
                </span>
                <span className="num w-24 text-right text-xs"><span className="text-fg">{nf(s.byRegime[r])}</span> <span className="text-fg-dim">· {nf(s.activeByRegime[r])}</span></span>
              </li>
            ))}
          </ul>
          <div className="flex gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-fg-muted/40" /> Todos los objetos</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-accent" /> Satélites operativos</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Por propietario" meta="Objetos en órbita" />
          <ul className="grid gap-2 p-4">
            {s.owners.slice(0, 12).map((o) => (
              <li key={o.code} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm" title={OBJ_TYPES.map((t) => `${OBJ_LABEL[t]}: ${nf(o[t])}`).join(" · ")}>
                <span className="truncate">{OWNER_NAME[o.code] ?? o.code}</span>
                <span className="flex h-4 gap-[2px] overflow-hidden rounded-[3px]" style={{ width: `${Math.max(2, (o.total / ownMax) * 100)}%` }}>
                  {OBJ_TYPES.map((t) => o[t] > 0 && <span key={t} className="h-full" style={{ width: `${(o[t] / o.total) * 100}%`, background: TYPE_COLORS[t] }} />)}
                </span>
                <span className="num w-16 text-right">{nf(o.total)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-muted">
            {OBJ_TYPES.map((t) => <span key={t} className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: TYPE_COLORS[t] }} /> {OBJ_LABEL[t]}</span>)}
          </div>
        </Card>

        <Card>
          <CardHeader title="Reentradas recientes" meta="Últimos 45 días" />
          {s.recentDecays.length ? (
            <ul className="max-h-[440px] divide-y divide-line overflow-y-auto text-sm">
              {s.recentDecays.map((d) => (
                <li key={d.norad}>
                  <Link href={`/satelites/${d.norad}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-2">
                    <span className="size-2 shrink-0 rounded-sm" style={{ background: TYPE_COLORS[d.type] }} title={OBJ_LABEL[d.type]} />
                    <span className="min-w-0 flex-1"><span className="block truncate">{d.name}</span><span className="block truncate text-[11px] text-fg-dim">{OBJ_LABEL[d.type]} · {OWNER_NAME[d.owner] ?? d.owner} · lanzado {d.launch.slice(0, 4)}</span></span>
                    <span className="num shrink-0 text-xs text-fg-muted">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Sin reentradas registradas.</Empty>}
        </Card>
      </div>

      {s.beyond.length > 0 && (
        <Card>
          <CardHeader title="Fuera de la órbita terrestre" meta="Cargas útiles alrededor del Sol, la Luna y otros planetas" />
          <ul className="grid grid-cols-1 gap-px bg-line text-sm sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(s.beyond.reduce<Record<string, number>>((m, b) => ((m[b.center] = (m[b.center] ?? 0) + 1), m), {}))
              .sort((a, b) => b[1] - a[1])
              .map(([c, n]) => (
                <li key={c} className="bg-surface px-4 py-3"><span className="num text-xl">{n}</span><span className="block text-xs text-fg-muted">{CENTER_NAME[c] ?? c}</span></li>
              ))}
          </ul>
        </Card>
      )}

      <p className="text-[11px] text-fg-dim">Fuente: CelesTrak SATCAT (catálogo derivado del de la Fuerza Espacial de EE. UU.) · actualizado el {updated}. Solo incluye objetos rastreables (≈ más de 10 cm en órbita baja).</p>
    </div>
  );
}
