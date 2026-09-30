"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

export type Field =
  | { kind: "search"; key: string; placeholder: string }
  | { kind: "select"; key: string; label: string; options: [string, string][] }
  | { kind: "segmented"; key: string; options: [string, string][] };

/** Filtros genéricos sincronizados con la URL. */
export function UrlFilters({ fields, count, noun }: { fields: Field[]; count: number; noun: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const searchField = fields.find((f) => f.kind === "search");
  const [q, setQ] = useState(searchField ? sp.get(searchField.key) ?? "" : "");

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    start(() => router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const first = useRef(true);
  useEffect(() => {
    if (first.current || !searchField) { first.current = false; return; }
    const t = setTimeout(() => set(searchField.key, q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={clsx("mb-5 flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-70")}>
      {fields.map((f) =>
        f.kind === "search" ? (
          <div key={f.key} className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.placeholder}
              className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-[13px] text-fg placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
          </div>
        ) : f.kind === "segmented" ? (
          <div key={f.key} className="flex rounded-md border border-line bg-surface p-0.5 text-[13px]">
            {f.options.map(([v, l]) => (
              <button key={v} onClick={() => set(f.key, v)}
                className={clsx("rounded px-3 py-1.5", (sp.get(f.key) ?? "") === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>{l}</button>
            ))}
          </div>
        ) : (
          <select key={f.key} aria-label={f.label} value={sp.get(f.key) ?? ""} onChange={(e) => set(f.key, e.target.value)}
            className="h-9 max-w-52 rounded-md border border-line bg-surface px-2 text-[13px] text-fg">
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ),
      )}
      <span className="ml-auto text-xs text-fg-muted"><span className="num text-fg">{count.toLocaleString("es")}</span> {noun}</span>
    </div>
  );
}
