"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ExternalLink, Footprints, Rocket, Timer, User, Users, X } from "lucide-react";
import type { Astronaut, Station } from "@/lib/data/space";
import type { OMM } from "@/lib/orbit";
import { useNow } from "@/lib/hooks/client";
import { Flag } from "@/components/ui/Flag";
import { countryName } from "@/lib/format";
import dynamic from "next/dynamic";

const Skel = ({ h }: { h: number }) => <div style={{ height: h }} className="w-full animate-pulse bg-surface-2" />;
const SatLive = dynamic(() => import("@/components/orbit/SatLive").then((m) => m.SatLive), { ssr: false, loading: () => <Skel h={560} /> });
const OrbitViewer = dynamic(() => import("@/components/orbit/OrbitViewer").then((m) => m.OrbitViewer), { ssr: false, loading: () => <Skel h={430} /> });

const ROLES: Record<string, string> = {
  Commander: "Comandante",
  "Flight Engineer": "Ingeniería de vuelo",
  Pilot: "Piloto",
  "Mission Specialist": "Especialista de misión",
  Operator: "Operación",
  "Payload Specialist": "Especialista de carga útil",
  "Spaceflight Participant": "Participante",
  "Space Tourist": "Turista espacial",
};
const roleEs = (r: string | null) => (r ? ROLES[r] ?? r : null);
const days = (iso: string | null) => { const m = iso && /^P(?:(\d+)D)?/.exec(iso); return m ? Number(m[1] ?? 0) : null; };
const hours = (iso: string | null) => { const m = iso && /T(?:(\d+)H)?(?:(\d+)M)?/.exec(iso); return m ? Number(m[1] ?? 0) + Number(m[2] ?? 0) / 60 : null; };

/** NORAD de cada estación para calcular su posición (ISS 25544 · Tiangong/CSS 48274). */
const noradOf = (name: string) => (/international space station|\bISS\b/i.test(name) ? 25544 : /tiangong|\bCSS\b/i.test(name) ? 48274 : null);

export function InSpace({ stations, astronauts, gp }: { stations: Station[]; astronauts: Astronaut[]; gp: OMM[]; at?: number }) {
  const now = useNow();
  const withGp = useMemo(() => stations.map((s) => ({ s, omm: gp.find((o) => o.NORAD_CAT_ID === noradOf(s.name)) ?? null })), [stations, gp]);
  const [sel, setSel] = useState(0);
  const [person, setPerson] = useState<Astronaut | null>(null);
  const current = withGp[sel];
  const crew = astronauts.filter((a) => current && a.stationId === current.s.id);
  const others = astronauts.filter((a) => !stations.some((s) => s.id === a.stationId));
  const nations = [...new Set(astronauts.flatMap((a) => a.nationality))];
  const totalDays = astronauts.reduce((n, a) => n + (days(a.timeInSpace) ?? 0), 0);

  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPerson(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [person]);

  // Contador en vivo de la expedición
  const exp = current?.s.expeditions[0];
  const elapsed = exp?.start && now ? now - new Date(exp.start).getTime() : null;
  const dd = elapsed !== null ? Math.floor(elapsed / 864e5) : null;
  const hh = elapsed !== null ? Math.floor((elapsed % 864e5) / 36e5) : null;
  const mm = elapsed !== null ? Math.floor((elapsed % 36e5) / 6e4) : null;
  const ss = elapsed !== null ? Math.floor((elapsed % 6e4) / 1e3) : null;
  const p2 = (n: number | null) => (n === null ? "--" : String(n).padStart(2, "0"));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Resumen */}
      <section className="relative overflow-hidden rounded-lg border border-line bg-surface p-5 md:p-7">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <p className="label mb-2 flex items-center gap-2 !text-accent"><span className="size-1.5 animate-pulse-dot rounded-full bg-accent" /> Ahora mismo en órbita</p>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="num text-6xl leading-none font-medium md:text-7xl">{astronauts.length}</p>
            <p className="mt-2 text-sm text-fg-muted">personas en el espacio</p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div><p className="num text-2xl">{stations.length}</p><p className="text-fg-dim">estaciones activas</p></div>
            <div><p className="num text-2xl">{nations.length}</p><p className="text-fg-dim">países</p></div>
            <div><p className="num text-2xl">{totalDays.toLocaleString("es")}</p><p className="text-fg-dim">días acumulados</p></div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {astronauts.map((a) => (
            <button key={a.id} onClick={() => setPerson(a)} title={a.name}
              className="group relative size-10 overflow-hidden rounded-full border border-line bg-surface-3 transition hover:z-10 hover:scale-110 hover:border-accent">
              {a.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl} alt={a.name} className="size-full object-cover" loading="lazy" />
              ) : <User className="m-auto size-4 text-fg-dim" />}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-fg-dim">Fuente: Launch Library 2 · posiciones calculadas en vivo · toca una cara para ver su ficha.</p>
      </section>

      {/* Las estaciones alrededor de la Tierra + ficha de la estación elegida */}
      {current && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-lg border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
              <div className="flex gap-1.5" role="tablist" aria-label="Estaciones">
                {withGp.map(({ s }, i) => (
                  <button key={s.id} role="tab" aria-selected={sel === i} onClick={() => setSel(i)}
                    className={clsx("rounded-md px-3 py-1.5 text-[13px] transition-colors", sel === i ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
                    {s.name.replace(/ space station$/i, "")}
                  </button>
                ))}
              </div>
              <Link href="/satelites?g=stations" className="text-xs text-fg-muted hover:text-fg">Explorador de satélites →</Link>
            </header>
            {gp.length > 0 ? <OrbitViewer objects={gp} height={430} /> : <p className="p-6 text-sm text-fg-dim">No hay elementos orbitales disponibles ahora mismo.</p>}
          </section>

          <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <div className="relative h-28 shrink-0 bg-surface-3">
              {current.s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.s.imageUrl} alt="" className="size-full object-cover opacity-70" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
              <div className="absolute bottom-2.5 left-4">
                <p className="label !text-fg-muted">{current.s.orbit}</p>
                <h2 className="text-lg font-semibold">{current.s.name}</h2>
              </div>
            </div>
            {exp && (
              <div className="border-b border-line px-4 py-3">
                <p className="label mb-1.5 flex items-center gap-1.5"><Timer className="size-3.5" /> {exp.name} · en curso</p>
                <div className="flex items-end gap-1" role="timer" aria-label="Tiempo de la expedición">
                  {[[dd === null ? "--" : String(dd), "días"], [p2(hh), "h"], [p2(mm), "min"], [p2(ss), "s"]].map(([v, l], i) => (
                    <div key={l} className="flex items-end gap-1">
                      {i > 0 && <span className="num mb-3 text-lg text-fg-dim">:</span>}
                      <div className="flex flex-col items-center"><span className="num text-2xl leading-none">{v}</span><span className="label mt-1">{l}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-3 gap-px border-b border-line bg-line text-sm">
              <div className="bg-surface p-3"><dt className="label">A bordo</dt><dd className="num mt-1 text-xl">{crew.length || current.s.crew || 0}</dd></div>
              <div className="bg-surface p-3"><dt className="label">Acopladas</dt><dd className="num mt-1 text-xl">{current.s.docked ?? "—"}</dd></div>
              <div className="bg-surface p-3"><dt className="label">Desde</dt><dd className="num mt-1 text-xl">{current.s.founded ? new Date(current.s.founded).getUTCFullYear() : "—"}</dd></div>
            </dl>
            {current.s.ports.some((pt) => pt.vehicle) && (
              <div className="border-b border-line px-4 py-3">
                <p className="label mb-1.5">Naves acopladas</p>
                <ul className="space-y-1 text-sm">
                  {current.s.ports.filter((pt) => pt.vehicle).map((pt) => (
                    <li key={pt.name} className="flex items-center gap-2"><span className="size-1.5 shrink-0 rounded-full bg-accent" /><span className="truncate">{pt.vehicle}</span><span className="truncate text-xs text-fg-dim">· {pt.name}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {current.s.owners.length > 0 && (
              <p className="mt-auto px-4 py-3 text-xs text-fg-muted"><span className="label mr-2">Operan</span>
                {current.s.owners.map((o, i) => <span key={o.id}>{i > 0 && ", "}<Link href={`/organizaciones/${o.id}`} className="hover:text-fg hover:underline">{o.name}</Link></span>)}
              </p>
            )}
          </section>
        </div>
      )}

      {/* Tripulación de la estación elegida (solo si la fuente la detalla) */}
      {crew.length > 0 && (
        <section className="rounded-lg border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="label flex items-center gap-1.5 !text-fg-muted"><Users className="size-3.5" /> Tripulación a bordo</h2>
            <span className="num text-xs text-fg-dim">{crew.length}</span>
          </header>
          <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {crew.map((a) => <CrewCard key={a.id} a={a} onOpen={() => setPerson(a)} />)}
          </ul>
        </section>
      )}

      {/* Posición en vivo, traza y pasos sobre ti */}
      {current?.omm && <SatLive omm={current.omm} />}

      {others.length > 0 && (
        <section className="rounded-lg border border-line bg-surface">
          <header className="border-b border-line px-4 py-3">
            <h2 className="label !text-fg-muted">{crew.length > 0 || stations.some((st) => astronauts.some((a) => a.stationId === st.id)) ? "También en el espacio" : "Personas en órbita"}</h2>
          </header>
          <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {others.map((a) => <CrewCard key={a.id} a={a} onOpen={() => setPerson(a)} />)}
          </ul>
        </section>
      )}

      {/* Ficha de una persona */}
      {person && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setPerson(null)}>
          <div role="dialog" aria-label={person.name} onClick={(e) => e.stopPropagation()}
            className="animate-fade-in max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line-strong bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex gap-4 border-b border-line p-5">
              <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-3">
                {person.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.imageUrl} alt="" className="size-full object-cover" />
                ) : <User className="m-auto mt-8 size-6 text-fg-dim" />}
              </div>
              <div className="min-w-0 flex-1">
                {roleEs(person.role) && <p className="label mb-1 !text-accent">{roleEs(person.role)}</p>}
                <h3 className="text-xl font-semibold leading-tight">{person.name}</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  {person.nationality.map((c) => <span key={c} className="mr-2"><Flag code={c} /> {countryName(c)}</span>)}
                </p>
                {person.agencyId && <Link href={`/organizaciones/${person.agencyId}`} className="mt-1 inline-block text-sm text-fg-muted hover:text-fg hover:underline">{person.agency}</Link>}
              </div>
              <button onClick={() => setPerson(null)} className="self-start rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar"><X className="size-5" /></button>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-4">
              <Stat k="Días en el espacio" v={days(person.timeInSpace)?.toLocaleString("es") ?? "—"} />
              <Stat k="Vuelos" v={person.flights ?? "—"} />
              <Stat k="Caminatas (EVA)" v={person.spacewalks ?? "—"} />
              <Stat k="Horas de EVA" v={hours(person.evaTime) ? Math.round(hours(person.evaTime)!).toLocaleString("es") : "—"} />
            </dl>
            <div className="space-y-3 p-5 text-sm">
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-fg-muted">
                {person.age && <span>Edad: <span className="text-fg">{person.age}</span></span>}
                {person.firstFlight && <span className="inline-flex items-center gap-1"><Rocket className="size-3.5" /> Primer vuelo: <span className="text-fg">{new Date(person.firstFlight).toLocaleDateString("es", { dateStyle: "medium" })}</span></span>}
                {person.lastFlight && <span>Vuelo actual desde: <span className="text-fg">{new Date(person.lastFlight).toLocaleDateString("es", { dateStyle: "medium" })}</span></span>}
              </p>
              {person.bio && (
                <div>
                  <p className="label mb-1">Biografía <span className="normal-case tracking-normal text-fg-dim">(inglés, Launch Library 2)</span></p>
                  <p lang="en" className="leading-relaxed text-fg-muted">{person.bio}</p>
                </div>
              )}
              {person.wiki && (
                <a href={person.wiki} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                  Wikipedia <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrewCard({ a, onOpen }: { a: Astronaut; onOpen: () => void }) {
  const d = days(a.timeInSpace);
  return (
    <li>
      <button onClick={onOpen} className="group flex w-full items-center gap-3 bg-surface p-4 text-left transition-colors hover:bg-surface-2">
        <div className="size-14 shrink-0 overflow-hidden rounded-full border border-line bg-surface-3 transition group-hover:border-accent">
          {a.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : <User className="m-auto mt-4 size-5 text-fg-dim" />}
        </div>
        <div className="min-w-0 flex-1">
          {roleEs(a.role) && <p className="label !text-accent">{roleEs(a.role)}</p>}
          <p className="truncate text-[14px] font-medium">{a.name}</p>
          <p className="truncate text-xs text-fg-dim">{a.nationality.slice(0, 2).map((c) => <span key={c} className="mr-1.5"><Flag code={c} /> {countryName(c)}</span>)}· {a.agencyAbbrev ?? a.agency}</p>
          <p className="mt-0.5 flex items-center gap-3 text-[11px] text-fg-dim">
            {d !== null && <span><span className="num text-fg-muted">{d.toLocaleString("es")}</span> días</span>}
            {a.spacewalks ? <span className="inline-flex items-center gap-1"><Footprints className="size-3" /> <span className="num">{a.spacewalks}</span> EVA</span> : null}
          </p>
        </div>
      </button>
    </li>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="label">{k}</dt>
      <dd className="num mt-1 text-lg">{v}</dd>
    </div>
  );
}
