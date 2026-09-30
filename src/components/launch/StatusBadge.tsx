import clsx from "clsx";
import { statusInfo, type StatusKey } from "@/lib/format";

const COLORS: Record<StatusKey, string> = {
  go: "text-go border-go/30 bg-go/10",
  tbc: "text-tbc border-tbc/30 bg-tbc/10",
  tbd: "text-fg-muted border-line-strong bg-surface-3",
  hold: "text-hold border-hold/30 bg-hold/10",
  flight: "text-flight border-flight/30 bg-flight/10",
  success: "text-success border-success/30 bg-success/10",
  failure: "text-failure border-failure/30 bg-failure/10",
  partial: "text-partial border-partial/30 bg-partial/10",
};

const DOT: Record<StatusKey, string> = {
  go: "bg-go", tbc: "bg-tbc", tbd: "bg-tbd", hold: "bg-hold",
  flight: "bg-flight animate-pulse-dot", success: "bg-success", failure: "bg-failure", partial: "bg-partial",
};

export function StatusBadge({ abbrev, className }: { abbrev: string | null; className?: string }) {
  const s = statusInfo(abbrev);
  return (
    <span
      title={s.hint}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wider whitespace-nowrap",
        COLORS[s.key],
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", DOT[s.key])} />
      {s.label}
    </span>
  );
}

export function StatusDot({ abbrev }: { abbrev: string | null }) {
  return <span className={clsx("inline-block size-2 shrink-0 rounded-full", DOT[statusInfo(abbrev).key])} />;
}
