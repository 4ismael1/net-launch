import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { LaunchCard } from "@/lib/data/launches";
import { Card, CardHeader, Empty } from "@/components/ui/Card";
import { LaunchRow } from "@/components/launch/LaunchRow";

export function LaunchListCard({ title, rows, empty, more }: { title: string; rows: LaunchCard[]; empty: string; more?: string }) {
  return (
    <Card>
      <CardHeader title={title} action={more && rows.length ? <Link href={more} className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">Ver todos <ArrowRight className="size-3.5" /></Link> : undefined} />
      {rows.length ? <ul className="divide-y divide-line">{rows.map((l) => <LaunchRow key={l.id} l={l} showCountdown={false} />)}</ul> : <Empty>{empty}</Empty>}
    </Card>
  );
}

/** Barras apiladas por año (éxitos / fallos). SVG liviano; las gráficas completas están en Estadísticas. */
export function YearBars({ data }: { data: { year: number; success: number; failure: number }[] }) {
  const rows = data.slice(-20);
  if (!rows.length) return <Empty>Sin lanzamientos completados registrados.</Empty>;
  const max = Math.max(...rows.map((r) => r.success + r.failure), 1);
  const W = 600, H = 150, gap = 4, bw = (W - gap * (rows.length - 1)) / rows.length;
  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Lanzamientos por año">
        {rows.map((r, i) => {
          const x = i * (bw + gap);
          const hs = (r.success / max) * H, hf = (r.failure / max) * H;
          return (
            <g key={r.year}>
              <title>{`${r.year}: ${r.success} éxitos, ${r.failure} fallos`}</title>
              <rect x={x} y={H - hs} width={bw} height={hs} rx={1.5} fill="var(--color-fg-muted)" />
              <rect x={x} y={H - hs - hf} width={bw} height={hf} rx={1.5} fill="var(--color-failure)" />
              {(rows.length <= 10 || i % Math.ceil(rows.length / 10) === 0 || i === rows.length - 1) && (
                <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--color-fg-dim)" fontFamily="var(--font-mono)">{`'${String(r.year).slice(-2)}`}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-fg-muted" /> Éxitos</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-failure" /> Fallos (total o parcial)</span>
      </div>
    </div>
  );
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <dl className="divide-y divide-line text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-fg-dim">{k}</dt>
          <dd className="min-w-0 text-right break-words text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Logo({ src, alt, size = 56 }: { src: string | null; alt: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-white/95 p-1.5" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="font-mono text-[11px] font-semibold text-bg">{alt.slice(0, 4).toUpperCase()}</span>
      )}
    </div>
  );
}
