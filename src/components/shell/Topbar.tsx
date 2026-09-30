import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { getLastSync, getNextLaunch } from "@/lib/data/launches";
import { Countdown } from "@/components/launch/Countdown";
import { StatusDot } from "@/components/launch/StatusBadge";
import { LocalTime } from "@/components/launch/LocalTime";
import { Logo } from "./Logo";

async function NextChip() {
  const next = await getNextLaunch();
  if (!next) return null;
  return (
    <Link
      href={`/lanzamientos/${next.slug}`}
      className="hidden min-w-0 items-center gap-3 rounded-md border border-line bg-surface px-3 py-1.5 transition-colors hover:border-line-strong lg:flex"
    >
      <span className="label !text-accent">Next</span>
      <StatusDot abbrev={next.statusAbbrev} />
      <span className="truncate text-[13px] text-fg">{next.name}</span>
      <span className="h-3 w-px bg-line-strong" />
      <Countdown net={next.net} precision={next.netPrecision} size="sm" />
    </Link>
  );
}

async function SyncInfo() {
  const at = await getLastSync();
  return (
    <span className="hidden items-center gap-2 text-[11px] text-fg-dim xl:flex" title="Fuente: Launch Library 2 (The Space Devs)">
      <span className="size-1.5 rounded-full bg-go animate-pulse-dot" />
      LL2 · <LocalTime date={at} mode="relative" />
    </span>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
      <Link href="/" className="md:hidden" aria-label="Inicio">
        <Logo />
      </Link>
      <Suspense fallback={null}>
        <NextChip />
      </Suspense>
      <div className="ml-auto flex items-center gap-4">
        <Suspense fallback={null}>
          <SyncInfo />
        </Suspense>
        <button
          type="button"
          data-search-trigger
          className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg-dim transition-colors hover:border-line-strong hover:text-fg-muted sm:w-64"
        >
          <Search className="size-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Buscar misión, cohete, base…</span>
          <kbd className="ml-auto hidden rounded-sm border border-line px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
        </button>
      </div>
    </header>
  );
}
