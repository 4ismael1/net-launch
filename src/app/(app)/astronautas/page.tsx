import type { Metadata } from "next";
import { listAstronauts } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { AstronautExplorer } from "@/components/space/AstronautExplorer";
import { countryName } from "@/lib/format";

export const metadata: Metadata = { title: "Astronautas" };

export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Astronautas de la historia"
        description="Todas las personas que han viajado al espacio desde 1961: tiempo acumulado en órbita, vuelos, paseos espaciales y país. Datos de Launch Library 2." />
      <Streamed fallback={<div className="grid gap-4"><div className="h-28 animate-pulse rounded-lg border border-line bg-surface" /><div className="h-80 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content />
      </Streamed>
    </div>
  );
}

async function Content() {
  const rows = await listAstronauts();
  if (!rows.length) return <Card><Empty>El catálogo de astronautas se está descargando de LL2 poco a poco (respetando su límite de peticiones). Vuelve en unas horas.</Empty></Card>;
  const inSpace = rows.filter((r) => r.inSpace).length;
  const totalYears = rows.reduce((s, r) => s + r.timeInSpace, 0) / (365.25 * 86400);
  const byCountry = new Map<string, number>();
  const byYear = new Map<number, number>();
  for (const r of rows) {
    if (r.country) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
    const y = r.first ? new Date(r.first).getUTCFullYear() : null;
    if (y) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
  const y0 = 1961, y1 = new Date().getUTCFullYear();
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ y: y0 + i, n: byYear.get(y0 + i) ?? 0 }));
  const max = Math.max(...years.map((x) => x.n), 1);
  const W = 720, H = 140, bw = W / years.length;
  const top = countries.slice(0, 8);
  const topMax = top[0]?.[1] ?? 1;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Han volado" value={rows.length.toLocaleString("es")} hint="Personas en el catálogo" />
        <Kpi label="En el espacio ahora" value={inSpace} />
        <Kpi label="Países" value={countries.length} />
        <Kpi label="Tiempo acumulado" value={`${Math.round(totalYears).toLocaleString("es")} años`} hint="Sumando a todas las personas" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Primer vuelo por año" meta="Personas que viajan por primera vez" />
          <div className="p-4">
            <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Personas que vuelan por primera vez, por año">
              {[0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - f * H} y2={H - f * H} stroke="var(--color-line)" strokeDasharray="2 4" />)}
              {years.map((x, i) => {
                const h = (x.n / max) * H;
                return (
                  <g key={x.y} className="group">
                    <title>{`${x.y}: ${x.n} ${x.n === 1 ? "persona" : "personas"}`}</title>
                    <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
                    <rect x={i * bw + 0.75} y={H - h} width={Math.max(1, bw - 1.5)} height={h} rx={1.5} className="fill-[#9c988e] transition-colors group-hover:fill-accent" />
                    {x.y % 10 === 0 && <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{x.y}</text>}
                  </g>
                );
              })}
              <text x={2} y={10} fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{max}</text>
            </svg>
          </div>
        </Card>
        <Card>
          <CardHeader title="Por país" meta="Nacionalidad principal" />
          <ul className="grid gap-2 p-4">
            {top.map(([c, n]) => (
              <li key={c} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="truncate"><Flag code={c} /> {countryName(c) ?? c}</span>
                <span className="h-4 overflow-hidden rounded-[3px] bg-surface-2"><span className="block h-full rounded-[3px] bg-fg-muted/70" style={{ width: `${(n / topMax) * 100}%` }} /></span>
                <span className="num w-10 text-right">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <AstronautExplorer rows={rows} />
    </div>
  );
}
