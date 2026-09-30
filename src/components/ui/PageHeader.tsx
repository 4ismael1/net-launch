import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label mb-1.5">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ phase, what }: { phase: string; what: string }) {
  return (
    <div className="grid-bg flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-line bg-surface text-center">
      <p className="label mb-2 !text-accent">En construcción · {phase}</p>
      <p className="max-w-md text-sm text-fg-muted">{what}</p>
    </div>
  );
}
