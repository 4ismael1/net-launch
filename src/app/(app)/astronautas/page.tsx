import type { Metadata } from "next";
import { listAstronauts } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { AstronautExplorer } from "@/components/space/AstronautExplorer";
import { countryName, durLabel } from "@/lib/format";
import Link from "next/link";
import { getInSpace } from "@/lib/data/space";

export const metadata: Metadata = {
  title: "Astronautas",
  description: "Quién está en el espacio ahora y todas las personas que han volado desde 1961: tiempo en órbita, vuelos, paseos espaciales y país.",
};

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
  const [rows, space] = await Promise.all([listAstronauts(), getInSpace()]);
  const now = space?.astronauts ?? [];
  const stationOf = (id: number | null) => {
    const n = space?.stations.find((s) => s.id === id)?.name;
    return !n ? null : /international/i.test(n) ? "Estación Espacial Internacional" : n.replace(/ space station$/i, "");
  };
  const hero = now.length > 0 && (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="label flex items-center gap-2 !text-fg-muted"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span> Ahora en el espacio · <span className="num !text-fg">{now.length}</span> personas</h2>
        <Link href="/en-el-espacio" className="text-xs text-fg-muted hover:text-fg">Dónde están →</Link>
      </header>
      <ul className="flex snap-x gap-px overflow-x-auto bg-line [scrollbar-width:thin]">
        {now.map((a) => (
          <li key={a.id} className="w-40 shrink-0 snap-start bg-surface">
            <Link href={`/astronautas/${a.id}`} className="group block">
              <span className="relative block aspect-[4/5] overflow-hidden bg-surface-3">
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : <span className="absolute inset-0 grid place-items-center text-fg-dim">—</span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-8 pb-2 text-[11px] text-white/80">{stationOf(a.stationId) ?? "En órbita"}</span>
              </span>
              <span className="block px-2.5 py-2">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block truncate text-[11px] text-fg-dim"><Flag code={a.nationality[0]} /> {a.agencyAbbrev ?? a.agency ?? ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!rows.length) return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {hero}
      <Card><Empty>El catálogo histórico de astronautas se está descargando de LL2 poco a poco (respetando su límite de peticiones). Vuelve en unas horas.</Empty></Card>
    </div>
  );
  const rec = (key: (a: (typeof rows)[number]) => number) => [...rows].filter((a) => key(a) > 0).sort((a, b) => key(b) - key(a))[0];
  const records = [
    { label: "Más tiempo en el espacio", a: rec((a) => a.timeInSpace), v: (a: (typeof rows)[number]) => durLabel(a.timeInSpace) },
    { label: "Más tiempo de paseos espaciales", a: rec((a) => a.eva), v: (a: (typeof rows)[number]) => `${durLabel(a.eva)} · ${a.spacewalks} salidas` },
    { label: "Más vuelos", a: rec((a) => a.flights), v: (a: (typeof rows)[number]) => `${a.flights} vuelos` },
    // Fechas anteriores a 1970 son negativas en ms: se busca el mínimo directamente
    { label: "Primera persona en el espacio", a: rows.filter((a) => a.first && Number.isFinite(Date.parse(a.first))).sort((a, b) => Date.parse(a.first!) - Date.parse(b.first!))[0], v: (a: (typeof rows)[number]) => (a.first ? new Date(a.first).getUTCFullYear().toString() : "") },
  ].filter((r) => r.a);
  // Misma fuente que el bloque "Ahora en el espacio" (instantánea cada 3 h); el catálogo semanal solo como respaldo
  const inSpace = space ? now.length : rows.filter((r) => r.inSpace).length;
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
      {hero}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Kpi label="Han volado" value={rows.length.toLocaleString("es")} hint="Personas en el catálogo" />
        <Kpi label="En el espacio ahora" value={inSpace} />
        <Kpi label="Países" value={countries.length} />
        <Kpi label="Tiempo acumulado" value={`${Math.round(totalYears).toLocaleString("es")} años`} hint="Sumando a todas las personas" />
      </div>

      {records.length > 0 && (
        <section>
          <h2 className="label mb-3 !text-fg-muted">Récords</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {records.map(({ label, a, v }) => (
              <li key={label}>
                <Link href={`/astronautas/${a!.id}`} className="group flex h-full gap-3 rounded-lg border border-line bg-surface p-3 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong">
                  <span className="size-16 shrink-0 overflow-hidden rounded-md bg-surface-3">
                    {a!.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a!.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="label block">{label}</span>
                    <span className="mt-1 block truncate font-medium">{a!.name}</span>
                    <span className="num block text-xs text-accent">{v(a!)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                    <rect x={i * bw + 0.75} y={H - h} width={Math.max(1, bw - 1.5)} height={h} rx={1.5} className="fill-fg-muted transition-colors group-hover:fill-accent" />
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
