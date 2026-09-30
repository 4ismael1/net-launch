"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

/** Búsqueda en todo el catálogo público (CelesTrak) por nombre o número NORAD. */
export function SatSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ norad: number; name: string; id: string }[] | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      fetch(`/api/satellites?q=${encodeURIComponent(t)}`, { signal: ctrl.signal }).then((r) => r.json()).then(setRes).catch(() => {});
    }, 400);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [q]);
  const show = q.trim().length >= 3 && res;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-3 left-3 size-4 text-fg-dim" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca cualquier satélite: HUBBLE, NOAA 19, SENTINEL, 25544…"
        className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
      {show && (
        <ul className="absolute inset-x-0 top-12 z-20 max-h-80 overflow-y-auto rounded-md border border-line-strong bg-surface-2 py-1 shadow-2xl">
          {res.length === 0 ? <li className="px-3 py-3 text-sm text-fg-dim">Sin resultados en el catálogo.</li> : res.map((r) => (
            <li key={r.norad}>
              <Link href={`/satelites/${r.norad}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-surface-3">
                <span className="truncate">{r.name}</span>
                <span className="num shrink-0 text-xs text-fg-dim">{r.norad} · {r.id}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
