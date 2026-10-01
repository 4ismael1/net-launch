"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { countryName } from "@/lib/format";

type Opt = { id: number; name: string; n: number };
export type FilterOptions = { operators: Opt[]; rockets: Opt[]; locations: Opt[]; countries: { code: string; n: number }[] };

const VISTAS = [["proximos", "Próximos"], ["pasados", "Pasados"], ["todos", "Todos"]] as const;
const ESTADOS: Record<string, [string, string][]> = {
  proximos: [["", "Todos los estados"], ["Go", "GO · confirmado"], ["TBC", "TBC · por confirmar"], ["TBD", "TBD · por determinar"], ["Hold", "HOLD"], ["In Flight", "En vuelo"]],
  pasados: [["", "Todos los resultados"], ["exitosos", "Exitosos"], ["fallidos", "Fallidos (total o parcial)"], ["Partial Failure", "Fallo parcial"]],
  todos: [["", "Todos los estados"], ["Go", "GO"], ["TBC", "TBC"], ["TBD", "TBD"], ["exitosos", "Exitosos"], ["fallidos", "Fallidos"]],
};

export function ExploreFilters({ options, total }: { options: FilterOptions; total: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [open, setOpen] = useState(false);
  const vista = sp.get("vista") ?? "proximos";

  // Siempre desde la URL actual (no la capturada al teclear): un filtro elegido durante el debounce no se pierde.
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(next.size ? `${path}?${next}` : path, { scroll: false }));
  };

  // Si la URL cambia desde fuera (búsqueda global, atrás/adelante), el campo la sigue.
  const [seenQ, setSeenQ] = useState(urlQ);
  if (urlQ !== seenQ) { setSeenQ(urlQ); setQ(urlQ); }

  // Búsqueda con debounce: solo si el texto difiere de la URL (no se dispara al volver a mostrar la página)
  useEffect(() => {
    if (q.trim() === urlQ) return;
    const t = setTimeout(() => set({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, urlQ]);

  const active = ["estado", "op", "pais", "cohete", "base", "dias", "desde", "hasta", "q"].filter((k) => sp.get(k));

  const sel = (k: string, label: string, items: [string, string][]) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label">{label}</span>
      <select value={sp.get(k) ?? ""} onChange={(e) => set({ [k]: e.target.value || null })}
        className="h-9 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-fg">
        {items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className={clsx("mb-5 space-y-3 transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface p-0.5 text-[13px]">
          {VISTAS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={vista === v} onClick={() => set({ vista: v === "proximos" ? null : v, estado: null, dias: null })}
              className={clsx("rounded px-3 py-1.5", vista === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por misión, cohete, operador o base…" aria-label="Buscar lanzamientos" type="search"
            className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-[13px] text-fg placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={clsx("inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] md:hidden", open ? "border-line-strong text-fg" : "border-line text-fg-muted")}>
          <SlidersHorizontal className="size-4" /> Filtros {active.length > 0 && <span className="num text-accent">{active.length}</span>}
        </button>
        <select value={sp.get("orden") ?? ""} onChange={(e) => set({ orden: e.target.value || null })} aria-label="Orden"
          className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-fg">
          <option value="">{vista === "proximos" ? "Más cercanos primero" : "Más recientes primero"}</option>
          <option value={vista === "proximos" ? "desc" : "asc"}>{vista === "proximos" ? "Más lejanos primero" : "Más antiguos primero"}</option>
        </select>
      </div>

      <div className={clsx("grid grid-cols-2 gap-3 md:grid md:grid-cols-4 xl:grid-cols-7", !open && "hidden")}>
        {sel("estado", "Estado", ESTADOS[vista] ?? ESTADOS.todos)}
        {sel("op", "Operador", [["", "Todos"], ...options.operators.map((o) => [String(o.id), o.name] as [string, string])])}
        {sel("pais", "País de la base", [["", "Todos"], ...options.countries.map((c) => [c.code, countryName(c.code) ?? c.code] as [string, string])])}
        {sel("cohete", "Cohete", [["", "Todos"], ...options.rockets.map((o) => [String(o.id), o.name] as [string, string])])}
        {sel("base", "Base", [["", "Todas"], ...options.locations.map((o) => [String(o.id), o.name] as [string, string])])}
        {vista === "proximos"
          ? sel("dias", "Periodo", [["", "Cualquiera"], ["7", "Próximos 7 días"], ["30", "Próximos 30 días"], ["90", "Próximos 90 días"]])
          : (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label">Desde</span>
              <input type="date" value={sp.get("desde") ?? ""} onChange={(e) => set({ desde: e.target.value || null })} className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-fg [color-scheme:dark]" />
            </label>
          )}
        {vista !== "proximos" && (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label">Hasta</span>
            <input type="date" value={sp.get("hasta") ?? ""} onChange={(e) => set({ hasta: e.target.value || null })} className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-fg [color-scheme:dark]" />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span><span className="num text-fg">{total.toLocaleString("es")}</span> resultados</span>
        {active.length > 0 && (
          <button type="button" onClick={() => { setQ(""); start(() => router.replace(vista === "proximos" ? path : `${path}?vista=${vista}`, { scroll: false })); }}
            className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-0.5 hover:text-fg">
            <X className="size-3" /> Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
