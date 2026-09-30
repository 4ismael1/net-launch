"use client";

import Link from "next/link";
import clsx from "clsx";
import { useLive } from "@/lib/hooks/live";
import { useNow } from "@/lib/hooks/client";
import { Countdown } from "@/components/launch/Countdown";
import { StatusDot } from "@/components/launch/StatusBadge";
import { relativeTime } from "@/lib/format";

type Chip = { slug: string; name: string; statusAbbrev: string | null; net: Date | string | null; netPrecision: string | null };

export function LiveNextChip({ initial }: { initial: Chip }) {
  const live = useLive();
  const n: Chip = live?.next ?? initial;
  return (
    <Link href={`/lanzamientos/${n.slug}`}
      className="hidden min-w-0 items-center gap-3 rounded-md border border-line bg-surface px-3 py-1.5 transition-colors hover:border-line-strong lg:flex">
      <span className="label !text-accent">Next</span>
      <StatusDot abbrev={n.statusAbbrev} />
      <span className="truncate text-[13px] text-fg">{n.name}</span>
      <span className="h-3 w-px bg-line-strong" />
      <Countdown net={n.net} precision={n.netPrecision} size="sm" status={n.statusAbbrev} />
    </Link>
  );
}

/** Última sincronización con LL2; aviso si los datos tienen más de 1 hora. */
export function LiveSyncInfo({ initial }: { initial: string | null }) {
  const live = useLive();
  const now = useNow();
  const at = live?.lastSync ?? initial;
  const age = at && now ? (now - new Date(at).getTime()) / 60_000 : null;
  const stale = age !== null && age > 60;
  return (
    <span title="Fuente: Launch Library 2 (The Space Devs)"
      className={clsx("hidden items-center gap-2 text-[11px] xl:flex", stale ? "rounded-sm border border-tbc/30 bg-tbc/10 px-1.5 py-0.5 text-tbc" : "text-fg-dim")}>
      <span className={clsx("size-1.5 rounded-full", stale ? "bg-tbc" : "bg-go animate-pulse-dot")} />
      {at && now ? (stale ? `Datos de ${relativeTime(at, now).replace(/^hace /, "hace ")}` : `LL2 · ${relativeTime(at, now)}`) : "LL2"}
    </span>
  );
}
