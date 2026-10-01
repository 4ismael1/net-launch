"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Building2, Layers, MapPin, Rocket, Search, CornerDownLeft } from "lucide-react";
import { StatusDot } from "@/components/launch/StatusBadge";

type Res = {
  launches: { slug: string; name: string; net: string | null; status: string | null }[];
  orgs: { id: number; name: string; abbrev: string | null }[];
  rockets: { id: number; name: string }[];
  bases: { id: number; name: string; country: string | null }[];
};
const EMPTY: Res = { launches: [], orgs: [], rockets: [], bases: [] };
type Item = { key: string; group: string; label: string; sub?: string; href: string; icon: React.ReactNode };

/** Búsqueda global (Ctrl/Cmd+K): lanzamientos, organizaciones, cohetes y bases. */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ term: string; data: Res } | null>(null);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Foco: al abrir va al campo; al cerrar vuelve a donde estaba.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => returnFocus.current?.focus?.();
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((r: Res) => { setRes({ term, data: r }); setIdx(0); })
        .catch((e) => { if (e?.name !== "AbortError") setRes({ term, data: EMPTY }); });
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    // Solo resultados de lo que está escrito ahora (evita navegar a un resultado viejo con Enter).
    if (!res || res.term !== q.trim()) return [];
    const d = res.data;
    return [
      ...d.launches.map((l) => ({ key: `l${l.slug}`, group: "Lanzamientos", label: l.name, sub: l.net ? new Date(l.net).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : undefined, href: `/lanzamientos/${l.slug}`, icon: <StatusDot abbrev={l.status} /> })),
      ...d.orgs.map((o) => ({ key: `o${o.id}`, group: "Organizaciones", label: o.name, sub: o.abbrev ?? undefined, href: `/organizaciones/${o.id}`, icon: <Building2 className="size-4" /> })),
      ...d.rockets.map((r) => ({ key: `r${r.id}`, group: "Cohetes", label: r.name, href: `/vehiculos/${r.id}`, icon: <Layers className="size-4" /> })),
      ...d.bases.map((b) => ({ key: `b${b.id}`, group: "Bases", label: b.name, href: `/bases/${b.id}`, icon: <MapPin className="size-4" /> })),
    ];
  }, [res, q]);

  const pending = q.trim().length >= 2 && res?.term !== q.trim();

  const go = (it: Item | undefined) => {
    if (!it) {
      if (q.trim()) { router.push(`/lanzamientos?vista=todos&q=${encodeURIComponent(q.trim())}`); setOpen(false); }
      return;
    }
    router.push(it.href);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Buscar" aria-haspopup="dialog"
        className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg-dim transition-colors hover:border-line-strong hover:text-fg-muted sm:w-64">
        <Search className="size-4" strokeWidth={1.75} />
        <span className="hidden truncate whitespace-nowrap sm:inline">Buscar misión, cohete, base…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-sm border border-line px-1.5 font-mono text-[10px] whitespace-nowrap sm:inline">Ctrl K</kbd>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex animate-overlay-in items-start justify-center bg-bg/75 px-3 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Búsqueda global" className="w-full max-w-xl animate-pop-in overflow-hidden rounded-lg border border-line-strong bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-fg-dim" />
              <input ref={input} value={q} aria-label="Buscar" autoComplete="off" spellCheck={false} onChange={(e) => setQ(e.target.value)} placeholder="Falcon 9, Cape Canaveral, ISRO, Starlink…"
                className="h-12 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-dim focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                  if (e.key === "Enter") go(items[idx]);
                }} />
              <kbd className="rounded-sm border border-line px-1.5 font-mono text-[10px] text-fg-dim">ESC</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto py-1">
              {q.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-sm text-fg-dim">Escribe al menos 2 letras. Busca lanzamientos, organizaciones, cohetes y bases.</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-fg-dim">{pending ? "Buscando…" : "Sin coincidencias."}</p>
              ) : (
                items.map((it, i) => (
                  <div key={it.key}>
                    {(i === 0 || items[i - 1].group !== it.group) && <p className="label px-4 pt-3 pb-1">{it.group}</p>}
                    <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(it)}
                      ref={i === idx ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                      className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left text-sm", i === idx ? "bg-surface-3 text-fg" : "text-fg-muted")}>
                      <span className="flex w-4 justify-center text-fg-dim">{it.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.sub && <span className="num shrink-0 text-xs text-fg-dim">{it.sub}</span>}
                      {i === idx && <CornerDownLeft className="size-3.5 shrink-0 text-fg-dim" />}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-[11px] text-fg-dim">
              <Rocket className="size-3.5" /> Enter sin selección busca en todos los lanzamientos
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
