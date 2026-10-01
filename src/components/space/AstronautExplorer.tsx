"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import clsx from "clsx";
import { Search, User } from "lucide-react";
import type { Astronaut } from "@/lib/data/catalog";
import { Flag } from "@/components/ui/Flag";
import { countryName, durLabel as dur } from "@/lib/format";

type Row = Omit<Astronaut, "bio" | "wiki" | "imageBig">;
type Sort = "tiempo" | "vuelos" | "eva" | "reciente" | "az";
const SORTS: [Sort, string][] = [["tiempo", "Tiempo en el espacio"], ["vuelos", "Vuelos"], ["eva", "Paseos espaciales"], ["reciente", "Primer vuelo reciente"], ["az", "A–Z"]];
const STATES: [string, string][] = [["", "Todos"], ["espacio", "En el espacio"], ["activos", "Activos"], ["retirados", "Retirados"], ["fallecidos", "Fallecidos"]];

const PAGE = 48;

export function AstronautExplorer({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState<Sort>("tiempo");
  const [shown, setShown] = useState(PAGE);
  const dq = useDeferredValue(q);

  const countries = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.country) m.set(r.country, (m.get(r.country) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const list = useMemo(() => {
    const n = dq.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const out = rows.filter((r) => {
      if (n && !`${r.name} ${r.agency ?? ""} ${r.agencyAbbrev ?? ""}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(n)) return false;
      if (country && r.country !== country) return false;
      if (state === "espacio") return r.inSpace;
      if (state === "activos") return r.status === "Active";
      if (state === "retirados") return r.status === "Retired";
      if (state === "fallecidos") return !!r.died || /Deceased|Lost/.test(r.status ?? "");
      return true;
    });
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      tiempo: (a, b) => b.timeInSpace - a.timeInSpace,
      vuelos: (a, b) => b.flights - a.flights || b.timeInSpace - a.timeInSpace,
      eva: (a, b) => b.eva - a.eva || b.spacewalks - a.spacewalks,
      reciente: (a, b) => (b.first ?? "").localeCompare(a.first ?? ""),
      az: (a, b) => a.name.localeCompare(b.name, "es"),
    };
    return out.sort(by[sort]);
  }, [rows, dq, state, country, sort]);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setShown(PAGE); };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
          <input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Buscar persona o agencia…" aria-label="Buscar"
            className="h-9 w-full rounded-md border border-line bg-surface pr-3 pl-8 text-[13px] text-fg placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
        </div>
        <div className="flex overflow-x-auto rounded-md border border-line bg-surface p-0.5 text-[13px]">
          {STATES.map(([v, l]) => (
            <button key={v} onClick={() => reset(setState)(v)} className={clsx("shrink-0 rounded px-3 py-1.5 transition-colors", state === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>{l}</button>
          ))}
        </div>
        <select aria-label="País" value={country} onChange={(e) => reset(setCountry)(e.target.value)} className="h-9 max-w-52 rounded-md border border-line bg-surface px-2 text-[13px] text-fg">
          <option value="">Todos los países</option>
          {countries.map(([c, n]) => <option key={c} value={c}>{countryName(c) ?? c} ({n})</option>)}
        </select>
        <select aria-label="Ordenar" value={sort} onChange={(e) => reset(setSort)(e.target.value as Sort)} className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-fg">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="ml-auto text-xs text-fg-muted"><span className="num text-fg">{list.length.toLocaleString("es")}</span> personas</span>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.slice(0, shown).map((a) => (
          <li key={a.id}>
            <Link href={`/astronautas/${a.id}`} className="group flex h-full gap-3 rounded-lg border border-line bg-surface p-3 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-3">
                {a.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : <User className="absolute inset-0 m-auto size-5 text-fg-dim" />}
                {a.inSpace && <span className="absolute right-1 bottom-1 size-2 rounded-full bg-accent ring-2 ring-surface" title="En el espacio ahora" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[14px] font-medium">{a.name}</p>
                <p className="truncate text-xs text-fg-dim"><Flag code={a.country} /> {a.agencyAbbrev ?? a.agency ?? countryName(a.country) ?? "—"}{a.died && " · †"}</p>
                <p className="mt-auto flex flex-wrap gap-x-3 pt-1.5 text-xs text-fg-muted">
                  <span><span className="num text-fg">{dur(a.timeInSpace)}</span></span>
                  <span><span className="num text-fg">{a.flights}</span> {a.flights === 1 ? "vuelo" : "vuelos"}</span>
                  {a.spacewalks > 0 && <span><span className="num text-fg">{a.spacewalks}</span> EVA</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="py-12 text-center text-sm text-fg-dim">Nadie coincide con estos filtros.</p>}
      {shown < list.length && (
        <div className="mt-5 flex justify-center">
          <button onClick={() => setShown((s) => s + PAGE * 2)} className="h-9 rounded-md border border-line-strong px-4 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
            Mostrar más <span className="num text-fg-dim">({(list.length - shown).toLocaleString("es")})</span>
          </button>
        </div>
      )}
    </div>
  );
}
