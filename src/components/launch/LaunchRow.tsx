import Link from "next/link";
import type { LaunchCard } from "@/lib/data/launches";
import { isPrecise } from "@/lib/format";
import { Flag } from "@/components/ui/Flag";
import { StatusBadge } from "./StatusBadge";
import { LocalTime } from "./LocalTime";
import { Countdown } from "./Countdown";

/** Fila compacta para listas del panel. */
export function LaunchRow({ l, showCountdown = true }: { l: LaunchCard; showCountdown?: boolean }) {
  return (
    <li>
      <Link href={`/lanzamientos/${l.slug}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
        <div className="size-10 shrink-0 overflow-hidden rounded-md border border-line bg-surface-3">
          {l.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-fg group-hover:text-white">{l.missionName ?? l.name}</p>
          <p className="truncate text-xs text-fg-dim">
            <Flag code={l.countryCode} /> {l.rocketName ?? "—"} · {l.providerAbbrev ?? l.providerName} · {l.locationName ?? l.padName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge abbrev={l.statusAbbrev} />
          {showCountdown && isPrecise(l.netPrecision) ? (
            <Countdown net={l.net} precision={l.netPrecision} size="sm" />
          ) : (
            <LocalTime date={l.net} precision={l.netPrecision} className="num text-[11px] text-fg-dim" />
          )}
        </div>
      </Link>
    </li>
  );
}
