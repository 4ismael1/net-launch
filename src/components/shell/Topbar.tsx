import Link from "next/link";
import { Suspense } from "react";
import { getLastSync, getNextLaunch } from "@/lib/data/launches";
import { Logo } from "./Logo";
import { SearchPalette } from "./SearchPalette";
import { LiveNextChip, LiveSyncInfo } from "./LiveBits";

async function NextChip() {
  const next = await getNextLaunch();
  if (!next) return null;
  return <LiveNextChip initial={{ slug: next.slug, name: next.name, statusAbbrev: next.statusAbbrev, net: next.net, netPrecision: next.netPrecision }} />;
}

async function SyncInfo() {
  const at = await getLastSync();
  return <LiveSyncInfo initial={at ? at.toISOString() : null} />;
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
        <SearchPalette />
      </div>
    </header>
  );
}
