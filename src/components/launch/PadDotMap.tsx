import Link from "next/link";

type Pt = { id: number; name: string; lat: number; lng: number; location_name: string | null; total: number | null; upcoming: number };

/**
 * Vista previa ligera (SVG, sin tiles) de las bases en proyección equirectangular.
 * El mapa interactivo completo vive en /mapa.
 */
export function PadDotMap({ points }: { points: Pt[] }) {
  const W = 720, H = 360;
  const x = (lng: number) => ((lng + 180) / 360) * W;
  const y = (lat: number) => ((90 - lat) / 180) * H;
  const max = Math.max(1, ...points.map((p) => p.total ?? 0));
  const sorted = [...points].sort((a, b) => (a.upcoming > 0 ? 1 : 0) - (b.upcoming > 0 ? 1 : 0));

  return (
    <Link href="/mapa" className="group relative block" aria-label="Abrir el mapa mundial">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bases de lanzamiento del mundo">
        {[...Array(11)].map((_, i) => (
          <line key={`v${i}`} x1={(i * W) / 12 + W / 12} x2={(i * W) / 12 + W / 12} y1={0} y2={H} stroke="var(--color-line)" strokeWidth={0.6} />
        ))}
        {[...Array(5)].map((_, i) => (
          <line key={`h${i}`} y1={(i * H) / 6 + H / 6} y2={(i * H) / 6 + H / 6} x1={0} x2={W} stroke={i === 2 ? "var(--color-line-strong)" : "var(--color-line)"} strokeWidth={0.6} />
        ))}
        {sorted.map((p) => {
          const r = 1.6 + Math.sqrt((p.total ?? 0) / max) * 7;
          const hot = p.upcoming > 0;
          return (
            <g key={p.id}>
              <title>{`${p.name}${p.location_name ? ` — ${p.location_name}` : ""} · ${p.total ?? 0} lanzamientos${hot ? ` · ${p.upcoming} próximos` : ""}`}</title>
              {hot && <circle cx={x(p.lng)} cy={y(p.lat)} r={r + 4} fill="var(--color-accent)" opacity={0.15} />}
              <circle cx={x(p.lng)} cy={y(p.lat)} r={r} fill={hot ? "var(--color-accent)" : "var(--color-fg-dim)"} opacity={hot ? 0.95 : 0.45} />
            </g>
          );
        })}
      </svg>
      <div className="absolute right-3 bottom-3 flex items-center gap-3 rounded-md border border-line bg-bg/80 px-2.5 py-1.5 text-[11px] text-fg-muted backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Con próximos</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-fg-dim" /> Histórico</span>
      </div>
    </Link>
  );
}
