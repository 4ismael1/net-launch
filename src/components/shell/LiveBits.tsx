"use client";

import Link from "next/link";
import { useState } from "react";
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
      <span className="label !text-accent">Próximo</span>
      <StatusDot abbrev={n.statusAbbrev} />
      <span className="truncate text-[13px] text-fg">{n.name}</span>
      <span className="h-3 w-px bg-line-strong" />
      <Countdown net={n.net} precision={n.netPrecision} size="sm" status={n.statusAbbrev} />
    </Link>
  );
}

/** Indicador discreto de la fuente; el detalle (hace cuánto, por qué) aparece al pasar el ratón o al hacer clic. */
export function LiveSyncInfo({ initial }: { initial: string | null }) {
  const live = useLive();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const at = live?.lastSync ?? initial;
  const age = at && now ? (now - new Date(at).getTime()) / 60_000 : null;
  const stale = age !== null && age > 60;
  return (
    <span className="relative hidden xl:inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}>
      <button type="button" onClick={(e) => setOpen((o) => (e.detail === 0 ? !o : true))} onBlur={() => setOpen(false)} aria-expanded={open} aria-label="Estado de los datos"
        className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] text-fg-dim hover:text-fg-muted">
        <span className={clsx("size-1.5 rounded-full", stale ? "bg-tbc" : "bg-go animate-pulse-dot")} />
        LL2
      </button>
      {open && (
        <span role="tooltip" className="absolute top-full right-0 z-50 mt-2 w-64 animate-pop-in rounded-md border border-line-strong bg-surface-2 p-3 text-xs text-fg-muted shadow-2xl">
          <span className="block font-medium text-fg">Launch Library 2 · The Space Devs</span>
          <span className="mt-1 block">
            Última sincronización: <span className={stale ? "text-tbc" : "text-fg"}>{at && now ? relativeTime(at, now) : "—"}</span>
          </span>
          <span className="mt-1.5 block leading-relaxed text-fg-dim">
            Horarios y estados se sincronizan automáticamente cada 15–25 min. Las cuentas regresivas y las órbitas se calculan en vivo en tu navegador.
          </span>
        </span>
      )}
    </span>
  );
}
