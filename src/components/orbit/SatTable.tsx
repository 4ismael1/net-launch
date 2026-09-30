"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { OMM } from "@/lib/orbit";
import { classify, ORBIT_COLORS, type OrbitKey } from "./ConstellationGlobe";

const MU = 398600.4418;
function params(o: OMM) {
  const n = (o.MEAN_MOTION * 2 * Math.PI) / 86400, a = Math.cbrt(MU / (n * n));
  return { period: 1440 / o.MEAN_MOTION, apo: a * (1 + o.ECCENTRICITY) - 6378, per: a * (1 - o.ECCENTRICITY) - 6378 };
}
type SortKey = "name" | "norad" | "per" | "inc" | "period" | "epoch";
const PAGE = 50;
const nf = (v: number, d = 0) => v.toLocaleString("es", { maximumFractionDigits: d });

/** Tabla del catálogo con búsqueda, filtro por órbita, orden y paginación (todo en el cliente). */
export function SatTable({ objects }: { objects: OMM[] }) {
  const [q, setQ] = useState("");
  const [orbit, setOrbit] = useState<OrbitKey | "">("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "name", dir: 1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => objects.map((o) => ({ o, cls: classify(o), ...params(o) })), [objects]);
  const counts = useMemo(() => rows.reduce((m, r) => ({ ...m, [r.cls]: (m[r.cls] ?? 0) + 1 }), {} as Record<string, number>), [rows]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = rows.filter((r) => (!orbit || r.cls === orbit) && (!t || r.o.OBJECT_NAME.toLowerCase().includes(t) || String(r.o.NORAD_CAT_ID).startsWith(t) || r.o.OBJECT_ID.toLowerCase().includes(t)));
    const val = (r: (typeof rows)[number]) =>
      sort.k === "name" ? r.o.OBJECT_NAME : sort.k === "norad" ? r.o.NORAD_CAT_ID : sort.k === "per" ? r.per : sort.k === "inc" ? r.o.INCLINATION : sort.k === "period" ? r.period : r.o.EPOCH;
    return f.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [rows, q, orbit, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const th = (k: SortKey, label: string) => (
    <th className="px-3 py-2 font-normal">
      <button onClick={() => { setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 })); setPage(0); }} className={clsx("label", sort.k === k && "!text-fg")}>
        {label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-dim" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Nombre, NORAD o COSPAR…"
            className="h-9 w-full rounded-md border border-line bg-bg pr-3 pl-8 text-[13px] placeholder:text-fg-dim focus:border-line-strong focus:outline-none" />
        </div>
        <div className="flex rounded-md border border-line bg-bg p-0.5 text-xs">
          {(["", "LEO", "MEO", "GEO", "HEO"] as const).map((k) => (
            <button key={k} onClick={() => { setOrbit(k); setPage(0); }} className={clsx("flex items-center gap-1.5 rounded px-2.5 py-1.5", orbit === k ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
              {k && <span className="size-1.5 rounded-full" style={{ background: ORBIT_COLORS[k] }} />}{k || "Todas"}{k && counts[k] ? <span className="num text-fg-dim">{counts[k]}</span> : null}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-fg-muted"><span className="num text-fg">{nf(filtered.length)}</span> objetos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-left"><tr>
            {th("name", "Nombre")}{th("norad", "NORAD")}<th className="label px-3 py-2 font-normal">COSPAR</th><th className="label px-3 py-2 font-normal">Órbita</th>
            {th("per", "Perigeo")}<th className="label px-3 py-2 font-normal">Apogeo</th>{th("inc", "Inclinación")}{th("period", "Periodo")}{th("epoch", "Época")}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {view.map(({ o, cls, per, apo, period }) => (
              <tr key={o.NORAD_CAT_ID} className="hover:bg-surface-2">
                <td className="px-3 py-2"><Link href={`/satelites/${o.NORAD_CAT_ID}`} className="hover:underline">{o.OBJECT_NAME}</Link></td>
                <td className="num px-3 py-2 text-fg-muted">{o.NORAD_CAT_ID}</td>
                <td className="num px-3 py-2 text-fg-dim">{o.OBJECT_ID}</td>
                <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 font-mono text-xs"><span className="size-1.5 rounded-full" style={{ background: ORBIT_COLORS[cls] }} />{cls}</span></td>
                <td className="num px-3 py-2 text-fg-muted">{nf(per)} km</td>
                <td className="num px-3 py-2 text-fg-muted">{nf(apo)} km</td>
                <td className="num px-3 py-2 text-fg-muted">{nf(o.INCLINATION, 1)}°</td>
                <td className="num px-3 py-2 text-fg-muted">{nf(period, 1)} min</td>
                <td className="num px-3 py-2 text-xs text-fg-dim">{o.EPOCH.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-line p-3 text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-line px-2.5 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          <span className="num px-2 text-fg-muted">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-line px-2.5 disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
