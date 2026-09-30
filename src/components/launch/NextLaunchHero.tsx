import Link from "next/link";
import { ArrowUpRight, MapPin, Play } from "lucide-react";
import type { LaunchCard } from "@/lib/data/launches";
import { countryName } from "@/lib/format";
import { Flag } from "@/components/ui/Flag";
import { Countdown } from "./Countdown";
import { StatusBadge } from "./StatusBadge";
import { LocalTime } from "./LocalTime";

export function NextLaunchHero({ l }: { l: LaunchCard }) {
  const country = countryName(l.countryCode);
  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-surface">
      {l.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.imageUrl} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-35 md:w-3/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/30 md:via-surface/80" />
        </>
      )}
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 p-5 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label !text-accent">Próximo lanzamiento</span>
          <StatusBadge abbrev={l.statusAbbrev} />
          {l.webcastLive && (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-failure px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-white">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-white" /> EN DIRECTO
            </span>
          )}
        </div>

        <div className="max-w-2xl">
          <p className="num mb-1 text-sm text-fg-muted">{l.rocketFullName ?? l.rocketName}</p>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[34px]">{l.missionName ?? l.name}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {l.providerName}
            {l.providerType && <span className="text-fg-dim"> · {l.providerType}</span>}
          </p>
        </div>

        <Countdown net={l.net} precision={l.netPrecision} />

        <dl className="grid max-w-3xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Field k="Fecha (tu hora)"><LocalTime date={l.net} precision={l.netPrecision} /></Field>
          <Field k="Plataforma">{l.padName ?? "—"}</Field>
          <Field k="Base">{l.locationName ?? "—"}</Field>
          <Field k="País">{country ? <><Flag code={l.countryCode} /> {country}</> : "—"}</Field>
          {l.orbitName && <Field k="Órbita">{l.orbitName}</Field>}
          {l.missionType && <Field k="Tipo de misión">{l.missionType}</Field>}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Link href={`/lanzamientos/${l.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg transition-opacity hover:opacity-90">
            Ver misión <ArrowUpRight className="size-4" />
          </Link>
          {l.padId && (
            <Link href={`/mapa?pad=${l.padId}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm text-fg hover:bg-surface-2">
              <MapPin className="size-4" /> Ver ubicación
            </Link>
          )}
          <Link href={`/lanzamientos/${l.slug}#transmision`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm text-fg hover:bg-surface-2">
            <Play className="size-4" /> Transmisión
          </Link>
        </div>
      </div>
    </section>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label mb-1">{k}</dt>
      <dd className="truncate text-fg">{children}</dd>
    </div>
  );
}
