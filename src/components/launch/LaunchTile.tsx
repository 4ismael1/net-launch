import Link from "next/link";
import { Rocket } from "lucide-react";
import type { ExploreRow } from "@/lib/data/explore";
import { isPrecise, padName } from "@/lib/format";
import { Flag } from "@/components/ui/Flag";
import { StatusBadge } from "./StatusBadge";
import { LocalTime } from "./LocalTime";
import { Countdown } from "./Countdown";

/** Tarjeta visual para el explorador. */
export function LaunchTile({ l }: { l: ExploreRow }) {
  const pending = ["Go", "TBC", "TBD", "Hold", "In Flight"].includes(l.statusAbbrev ?? "");
  return (
    <Link href={`/lanzamientos/${l.slug}`} className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-3">
        {l.thumbnailUrl || l.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.thumbnailUrl ?? l.imageUrl!} alt="" loading="lazy" className="size-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100" />
        ) : (
          <div className="grid-bg flex size-full items-center justify-center"><Rocket className="size-6 text-fg-dim" /></div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
        <div className="absolute top-2 left-2"><StatusBadge abbrev={l.statusAbbrev} className="bg-bg/85 backdrop-blur" /></div>
        {l.webcastLive && <span className="absolute top-2 right-2 rounded-sm bg-failure px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">EN DIRECTO</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="min-w-0">
          <p className="num truncate text-[11px] text-fg-dim">{l.rocketName ?? "Vehículo sin confirmar"}</p>
          <h3 className="line-clamp-2 text-[14.5px] leading-snug font-medium text-fg">{l.missionName ?? l.name}</h3>
        </div>
        <p className="truncate text-xs text-fg-muted">{l.providerName ?? "Operador desconocido"}</p>
        <p className="truncate text-xs text-fg-dim"><Flag code={l.countryCode} /> {l.locationName ?? padName(l.padName) ?? "—"}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
          <LocalTime date={l.net} precision={l.netPrecision} className="num truncate text-[11.5px] text-fg-muted" />
          {pending && isPrecise(l.netPrecision) && <Countdown net={l.net} precision={l.netPrecision} size="sm" />}
          {l.orbitAbbrev && !pending && <span className="num text-[11px] text-fg-dim">{l.orbitAbbrev}</span>}
        </div>
      </div>
    </Link>
  );
}
