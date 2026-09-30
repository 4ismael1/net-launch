import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("rounded-lg border border-line bg-surface", className)}>{children}</section>;
}

export function CardHeader({ title, action, meta }: { title: string; action?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex items-baseline gap-3">
        <h2 className="label !text-fg-muted">{title}</h2>
        {meta && <span className="text-xs text-fg-dim">{meta}</span>}
      </div>
      {action}
    </header>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 bg-surface px-4 py-4">
      <span className="label">{label}</span>
      <span className="num text-3xl font-medium text-fg">{value}</span>
      {hint && <span className="text-xs text-fg-dim">{hint}</span>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-fg-dim">{children}</p>;
}
