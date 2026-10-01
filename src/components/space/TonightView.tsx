"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LocateFixed, Loader2, MapPin, Eye, Satellite as SatIcon, ArrowUpRight, Telescope } from "lucide-react";
import { Body, Observer, SearchRiseSet, SearchAltitude, MoonPhase, Illumination, Equator, Horizon } from "astronomy-engine";
import { json2satrec, type SatRec } from "@/lib/sgp4";
import { computePasses, dir, passTrack, type Pass } from "@/lib/passes";
import type { OMM } from "@/lib/orbit";
import { useNow } from "@/lib/hooks/client";
import { splitCountdown } from "@/lib/format";

type Obs = { lat: number; lon: number; label: string; mine: boolean };
const DEFAULT: Obs = { lat: 6.2442, lon: -75.5812, label: "Medellín", mine: false };
const KEY = "net-observer";

// Ubicación guardada (solo en este navegador)
const subs = new Set<() => void>();
function readObs(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function saveObs(o: Obs | null) {
  try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch {}
  subs.forEach((s) => s());
}
// Suscripción estable (una función nueva en cada render obligaría a React a re-suscribirse cada segundo)
const subscribeObs = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
function useObserver(): Obs {
  const raw = useSyncExternalStore(subscribeObs, readObs, () => null);
  return useMemo(() => {
    try { return raw ? (JSON.parse(raw) as Obs) : DEFAULT; } catch { return DEFAULT; }
  }, [raw]);
}

const PLANETS: [Body, string][] = [[Body.Mercury, "Mercurio"], [Body.Venus, "Venus"], [Body.Mars, "Marte"], [Body.Jupiter, "Júpiter"], [Body.Saturn, "Saturno"]];
// Estrellas más brillantes (J2000: AR en horas, Dec en grados, magnitud)
const STARS: [string, number, number, number][] = [
  ["Sirio", 6.752, -16.716, -1.46], ["Canopus", 6.399, -52.696, -0.74], ["Rigil Kentaurus", 14.66, -60.834, -0.27], ["Arturo", 14.261, 19.182, -0.05],
  ["Vega", 18.616, 38.784, 0.03], ["Capella", 5.278, 45.998, 0.08], ["Rigel", 5.242, -8.202, 0.13], ["Proción", 7.655, 5.225, 0.34],
  ["Achernar", 1.629, -57.237, 0.46], ["Betelgeuse", 5.919, 7.407, 0.5], ["Hadar", 14.064, -60.373, 0.61], ["Altair", 19.846, 8.868, 0.76],
  ["Ácrux", 12.443, -63.099, 0.76], ["Aldebarán", 4.599, 16.509, 0.86], ["Antares", 16.49, -26.432, 0.96], ["Espiga", 13.42, -11.161, 0.97],
  ["Pólux", 7.755, 28.026, 1.14], ["Fomalhaut", 22.961, -29.622, 1.16], ["Deneb", 20.69, 45.28, 1.25], ["Mimosa", 12.795, -59.689, 1.25],
  ["Régulo", 10.14, 11.967, 1.35], ["Adhara", 6.977, -28.972, 1.5], ["Cástor", 7.577, 31.888, 1.58], ["Shaula", 17.56, -37.104, 1.62],
  ["Gacrux", 12.519, -57.113, 1.64], ["Bellatrix", 5.419, 6.35, 1.64], ["Polaris", 2.53, 89.264, 1.98],
];

const hm = (d: Date | null | undefined) => (d ? d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "—");

function phaseName(deg: number) {
  if (deg < 10 || deg > 350) return "Luna nueva";
  if (deg < 80) return "Creciente";
  if (deg < 100) return "Cuarto creciente";
  if (deg < 170) return "Gibosa creciente";
  if (deg < 190) return "Luna llena";
  if (deg < 260) return "Gibosa menguante";
  if (deg < 280) return "Cuarto menguante";
  return "Menguante";
}

/** Noche actual (si ya es de noche) o la próxima: del ocaso al orto, con los crepúsculos. */
function nightOf(o: Observer, now: Date) {
  const nextSet = SearchRiseSet(Body.Sun, o, -1, now, 1)?.date;
  const nextRise = SearchRiseSet(Body.Sun, o, +1, now, 1)?.date;
  const isNight = !!(nextRise && nextSet && nextRise < nextSet);
  const set = isNight ? SearchRiseSet(Body.Sun, o, -1, now, -1)?.date ?? new Date(now.getTime() - 6 * 3600_000) : nextSet ?? now;
  const rise = SearchRiseSet(Body.Sun, o, +1, set, 1)?.date ?? new Date(set.getTime() + 11 * 3600_000);
  const dusk = (alt: number) => SearchAltitude(Body.Sun, o, -1, set, 0.5, alt)?.date ?? null;
  const dawn = (alt: number) => SearchAltitude(Body.Sun, o, +1, new Date(rise.getTime() - 12 * 3600_000), 0.6, alt)?.date ?? null;
  return {
    set, rise, isNight,
    civil: [dusk(-6), dawn(-6)] as const, nautical: [dusk(-12), dawn(-12)] as const, astro: [dusk(-18), dawn(-18)] as const,
  };
}

function altAz(body: Body, d: Date, o: Observer) {
  const eq = Equator(body, d, o, true, true);
  const h = Horizon(d, o, eq.ra, eq.dec, "normal");
  return { alt: h.altitude, az: h.azimuth };
}

export function TonightView({ sats }: { sats: OMM[] }) {
  const obs = useObserver();
  const live = useNow();
  const [locating, setLocating] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  // Hora del cálculo: se fija al cargar y se renueva cada 10 min (la noche no cambia de un segundo a otro)
  const tick = live === null ? null : Math.floor(live / 600_000);
  const base = useMemo(() => (tick === null ? null : new Date(tick * 600_000)), [tick]);
  const o = useMemo(() => new Observer(obs.lat, obs.lon, 0), [obs.lat, obs.lon]);

  const night = useMemo(() => (base ? nightOf(o, base) : null), [o, base]);

  const sky = useMemo(() => {
    if (!night || !base) return null;
    const dark0 = night.civil[0] ?? night.set, dark1 = night.civil[1] ?? night.rise;
    const steps: Date[] = [];
    for (let t = night.set.getTime(); t <= night.rise.getTime(); t += 10 * 60_000) steps.push(new Date(t));
    const planets = PLANETS.map(([b, name]) => {
      let best = { alt: -90, az: 0, t: steps[0] };
      let up: [Date, Date] | null = null;
      for (const t of steps) {
        const p = altAz(b, t, o);
        const dark = t >= dark0 && t <= dark1;
        if (dark && p.alt > 5) {
          up = up ? [up[0], t] : [t, t];
          if (p.alt > best.alt) best = { alt: p.alt, az: p.az, t };
        }
      }
      return { body: b, name, visible: best.alt > 5, best, up, mag: Illumination(b, best.t).mag };
    });
    const moonAt = night.isNight ? base : dark0;
    const phase = MoonPhase(moonAt);
    const frac = Illumination(Body.Moon, moonAt).phase_fraction;
    const moonRise = SearchRiseSet(Body.Moon, o, +1, night.set, 1)?.date ?? null;
    const moonSet = SearchRiseSet(Body.Moon, o, -1, night.set, 1)?.date ?? null;
    // ¿Cuánto tiempo hay Luna sobre el horizonte en la noche cerrada?
    let moonUp = 0, darkMin = 0;
    for (const t of steps) if (t >= dark0 && t <= dark1) { darkMin += 10; if (altAz(Body.Moon, t, o).alt > 0) moonUp += 10; }
    return { planets, phase, frac, moonRise, moonSet, moonUp, darkMin };
  }, [night, base, o]);

  // Pasos visibles de satélites (cálculo por bloques para no congelar la página)
  const recs = useMemo(() => sats.map((s) => ({ name: s.OBJECT_NAME, norad: s.NORAD_CAT_ID, rec: json2satrec(s as never) as SatRec })), [sats]);
  const [passes, setPasses] = useState<{ key: string; list: (Pass & { name: string; norad: number })[]; done: number } | null>(null);
  const passKey = night ? `${obs.lat.toFixed(3)},${obs.lon.toFixed(3)},${night.set.getTime()}` : null;
  useEffect(() => {
    if (!night || !passKey) return;
    let cancelled = false;
    const from = Math.max(Date.now() - 10 * 60_000, (night.civil[0] ?? night.set).getTime());
    const to = (night.civil[1] ?? night.rise).getTime();
    const acc: (Pass & { name: string; norad: number })[] = [];
    let i = 0;
    const step = () => {
      if (cancelled) return;
      const end = Math.min(recs.length, i + 6);
      for (; i < end; i++) {
        const r = recs[i];
        for (const p of computePasses(r.rec, obs, { from, to, step: 30, minEl: 10, max: 8 })) if (p.visible) acc.push({ ...p, name: r.name, norad: r.norad });
      }
      setPasses({ key: passKey, list: [...acc].sort((a, b) => a.start.getTime() - b.start.getTime()), done: i });
      if (i < recs.length) setTimeout(step, 0);
    };
    const t = setTimeout(step, 30);
    return () => { cancelled = true; clearTimeout(t); };
    // Solo al cambiar la noche o el lugar (passKey los resume): `night` se renueva cada 10 min y reiniciar el cálculo
    // vaciaba la lista y el paso elegido mientras se rehacía
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passKey, recs]);
  const shownPasses = passes?.key === passKey ? passes : null;

  // Cúpula: hora elegida (por defecto, ahora si es de noche; si no, el fin del crepúsculo civil)
  const [pick, setPick] = useState<number | null>(null);
  const domeT = useMemo(() => {
    if (!night) return null;
    const def = night.isNight && live ? live : (night.civil[0] ?? night.set).getTime();
    return new Date(pick ?? def);
  }, [night, pick, live]);

  // Paso elegido (por defecto el próximo de una estación tripulada, o el próximo visible) y su trayectoria en el cielo
  const [selKey, setSelKey] = useState<string | null>(null);
  const upcomingPasses = useMemo(() => (shownPasses?.list ?? []).filter((p) => p.end.getTime() > (live ?? 0)), [shownPasses, live]);
  // Protagonista: una estación tripulada si pasa; si no, el paso más alto (los bajos cuestan de ver)
  const hero = useMemo(
    () => upcomingPasses.find((p) => p.norad === 25544 || p.norad === 48274) ?? upcomingPasses.reduce<(typeof upcomingPasses)[number] | null>((m, p) => (!m || p.maxEl > m.maxEl ? p : m), null),
    [upcomingPasses],
  );
  const selPass = (selKey && shownPasses?.list.find((p) => pkey(p) === selKey)) || null;
  const track = useMemo(() => {
    if (!selPass) return null;
    const r = recs.find((x) => x.norad === selPass.norad);
    return r ? { name: prettyName(selPass.name), pts: passTrack(r.rec, obs, selPass.start.getTime(), selPass.end.getTime(), 8) } : null;
  }, [selPass, recs, obs]);
  const choose = (p: Pass & { norad: number }) => { setSelKey(pkey(p)); setPick(p.peak.getTime()); };
  const moonUpInterval = useMemo(() => (night ? moonInterval(o, night) : null), [o, night]);

  const locate = () => {
    if (!navigator.geolocation) { setGeoErr("Tu navegador no permite la ubicación."); return; }
    setLocating(true);
    setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setPick(null); saveObs({ lat: p.coords.latitude, lon: p.coords.longitude, label: "Tu ubicación", mine: true }); },
      () => { setLocating(false); setGeoErr("No se pudo obtener la ubicación (permiso denegado o sin señal)."); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  if (!night || !sky || !domeT || !base) return <div className="h-[70vh] animate-pulse rounded-lg border border-line bg-surface" />;

  const span = night.rise.getTime() - night.set.getTime();
  const pos = (d: Date | null | undefined) => (d ? Math.min(100, Math.max(0, ((d.getTime() - night.set.getTime()) / span) * 100)) : null);
  const moonPct = sky.darkMin ? Math.round((sky.moonUp / sky.darkMin) * 100) : 0;
  const visiblePlanets = sky.planets.filter((p) => p.visible);
  const nowPct = live ? pos(new Date(live)) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Ubicación */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <MapPin className="size-4 text-fg-dim" />
        <span><span className="font-medium">{obs.label}</span> <span className="num text-xs text-fg-dim">{obs.lat.toFixed(2)}°, {obs.lon.toFixed(2)}°</span></span>
        {!obs.mine && <span className="text-xs text-fg-dim">(predeterminada)</span>}
        <div className="ml-auto flex gap-2">
          {obs.mine && <button onClick={() => saveObs(null)} className="h-8 rounded-md px-3 text-xs text-fg-muted hover:text-fg">Usar Medellín</button>}
          <button onClick={locate} disabled={locating} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-fg px-3 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60">
            {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />} {obs.mine ? "Actualizar ubicación" : "Usar mi ubicación"}
          </button>
        </div>
        {geoErr && <p className="w-full text-xs text-failure">{geoErr}</p>}
        <p className="w-full text-[11px] text-fg-dim">La ubicación se usa solo en tu navegador para calcular el cielo; no se envía a ningún servidor.</p>
      </div>

      {/* Próximo paso visible */}
      {hero && live !== null && <PassHero p={hero} now={live} onShow={() => choose(hero)} />}

      {/* Resumen de la noche */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <div className="bg-surface p-4"><p className="label">Puesta de Sol</p><p className="num mt-1.5 text-2xl">{hm(night.set)}</p><p className="mt-1 text-xs text-fg-dim">Noche cerrada desde {hm(night.astro[0] ?? night.nautical[0])}</p></div>
        <div className="bg-surface p-4"><p className="label">Salida del Sol</p><p className="num mt-1.5 text-2xl">{hm(night.rise)}</p><p className="mt-1 text-xs text-fg-dim">Primera luz {hm(night.astro[1] ?? night.nautical[1])}</p></div>
        <div className="flex items-center gap-3 bg-surface p-4">
          <MoonIcon phase={sky.phase} />
          <div><p className="label">Luna</p><p className="mt-1 text-base font-medium">{phaseName(sky.phase)}</p><p className="num text-xs text-fg-dim">{Math.round(sky.frac * 100)} % iluminada</p></div>
        </div>
        <div className="bg-surface p-4"><p className="label">Cielo oscuro</p><p className="mt-1.5 text-2xl">{moonPct < 25 ? "Muy bueno" : moonPct < 60 ? "Aceptable" : "Con Luna"}</p><p className="mt-1 text-xs text-fg-dim">Luna visible el {moonPct} % de la noche</p></div>
      </div>

      {/* Línea de la noche */}
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="label !text-fg-muted">La noche, hora a hora</h2><span className="text-[11px] text-fg-dim">Toca la barra para ver el cielo a esa hora</span></div>
        <div className="relative">
          <button
            aria-label={`Elegir hora de la noche: ${hm(domeT)} (flechas: ±15 min)`}
            className="relative block h-9 w-full cursor-pointer overflow-hidden rounded-md"
            style={{ background: twilightGradient(night, pos) }}
            onClick={(e) => {
              if (e.detail === 0) return; // Intro/Espacio: sin posición de puntero (se usan las flechas)
              const r = e.currentTarget.getBoundingClientRect();
              setPick(night.set.getTime() + ((e.clientX - r.left) / r.width) * span);
            }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const t = domeT.getTime() + (e.key === "ArrowRight" ? 1 : -1) * 15 * 60_000;
              setPick(Math.min(night.rise.getTime(), Math.max(night.set.getTime(), t)));
            }}
          >
            {shownPasses?.list.map((p) => (
              <span key={`${p.norad}-${p.start.getTime()}`} className="absolute top-1 bottom-1 w-[3px] rounded-full bg-fg" style={{ left: `${pos(p.peak)}%` }} title={`${p.name} · ${hm(p.start)}`} />
            ))}
            {nowPct !== null && nowPct > 0 && nowPct < 100 && <span className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${nowPct}%` }} />}
            <span className="absolute inset-y-0 w-px bg-fg/80 outline outline-1 outline-fg/30" style={{ left: `${pos(domeT)}%` }} />
          </button>
          <div className="mt-2 grid gap-1">
            {[{ name: "Luna", up: moonUpInterval }, ...visiblePlanets.map((p) => ({ name: p.name, up: p.up }))].map((r) => r.up && (
              <div key={r.name} className="relative h-4 text-[10px]">
                <span className="absolute inset-y-[5px] rounded-full bg-fg-muted/40" style={{ left: `${pos(r.up[0])}%`, width: `${(pos(r.up[1])! - pos(r.up[0])!)}%` }} />
                <span className="absolute -top-px text-fg-muted" style={{ left: `${Math.min(88, pos(r.up[0])!)}%` }}>&nbsp;{r.name}</span>
              </div>
            ))}
          </div>
          <div className="num mt-1 flex justify-between text-[10px] text-fg-dim"><span>{hm(night.set)}</span><span>{hm(new Date(night.set.getTime() + span / 2))}</span><span>{hm(night.rise)}</span></div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Cúpula */}
        <section className="rounded-lg border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="label !text-fg-muted">El cielo a las {hm(domeT)}{track && <span className="!text-accent"> · {track.name}</span>}</h2>
            {(pick !== null || track) && <button onClick={() => { setPick(null); setSelKey(null); }} className="text-xs text-fg-muted hover:text-fg">Volver a ahora</button>}
          </header>
          <Dome o={o} t={domeT} track={track} />
          <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Mirando hacia arriba: el centro es el cenit y el borde, el horizonte. Norte arriba, este a la izquierda.</p>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          {/* Planetas */}
          <section className="rounded-lg border border-line bg-surface">
            <header className="border-b border-line px-4 py-3"><h2 className="label !text-fg-muted">Planetas a simple vista</h2></header>
            <ul className="divide-y divide-line text-sm">
              {sky.planets.map((p) => (
                <li key={p.name} className={clsx("flex items-center gap-3 px-4 py-2.5", !p.visible && "opacity-50")}>
                  <span className="w-20 font-medium">{p.name}</span>
                  {p.visible ? (
                    <span className="flex-1 text-xs text-fg-muted">Mejor a las <span className="num text-fg">{hm(p.best.t)}</span> · {Math.round(p.best.alt)}° hacia el {dir(p.best.az)}</span>
                  ) : <span className="flex-1 text-xs text-fg-dim">No visible esta noche</span>}
                  <span className="num text-xs text-fg-dim" title="Magnitud (menor = más brillante)">mag {p.mag.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Pasos de satélites */}
          <section className="rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="label flex items-center gap-1.5 !text-fg-muted"><Eye className="size-3.5" /> Satélites visibles esta noche</h2>
              {shownPasses && shownPasses.done < recs.length ? (
                <span className="flex items-center gap-1.5 text-[11px] text-fg-dim"><Loader2 className="size-3 animate-spin" /> {shownPasses.done}/{recs.length}</span>
              ) : shownPasses && <span className="num text-xs text-fg-dim">{shownPasses.list.length}</span>}
            </header>
            {!shownPasses ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-fg-dim"><Loader2 className="size-4 animate-spin" /> Calculando pasos…</p>
            ) : shownPasses.list.length ? (
              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto text-sm">
                {shownPasses.list.map((p) => {
                  const crewed = p.norad === 25544 || p.norad === 48274;
                  const past = live !== null && p.end.getTime() < live;
                  return (
                    <li key={pkey(p)} className={clsx("group flex items-center transition-colors", past && "opacity-45", selKey === pkey(p) ? "bg-accent-soft" : "hover:bg-surface-2")}>
                      <button onClick={() => choose(p)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left">
                        <span className="num w-12 shrink-0 text-fg">{hm(p.start)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate">{crewed && <SatIcon className="size-3.5 shrink-0 text-accent" />}<span className="truncate">{prettyName(p.name)}</span></span>
                          <span className="block text-[11px] text-fg-dim">De {dir(p.azStart)} a {dir(p.azEnd)} · {Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 60_000))} min</span>
                        </span>
                        <span className="num shrink-0 text-xs text-fg-muted" title="Elevación máxima">{Math.round(p.maxEl)}°</span>
                      </button>
                      <Link href={`/satelites/${p.norad}`} className="mr-2 rounded p-1.5 text-fg-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg focus:opacity-100" aria-label="Ficha del satélite"><ArrowUpRight className="size-3.5" /></Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 py-6 text-sm text-fg-dim">Ningún paso visible esta noche desde aquí.</p>}
            <p className="border-t border-line px-4 py-2.5 text-[11px] text-fg-dim">Pasos con el satélite iluminado por el Sol y el cielo oscuro, a más de 10° sobre el horizonte. Calculados en tu navegador (SGP4, elementos de CelesTrak).</p>
          </section>
        </div>
      </div>
    </div>
  );
}

const pkey = (p: { norad: number; start: Date }) => `${p.norad}-${p.start.getTime()}`;
const prettyName = (n: string) => (/^ISS \(ZARYA\)/.test(n) ? "Estación Espacial Internacional" : /^CSS \(TIANHE\)/.test(n) ? "Estación Tiangong" : n);

function moonInterval(o: Observer, night: ReturnType<typeof nightOf>): [Date, Date] | null {
  let up: [Date, Date] | null = null;
  for (let t = night.set.getTime(); t <= night.rise.getTime(); t += 10 * 60_000) {
    const d = new Date(t);
    if (altAz(Body.Moon, d, o).alt > 0) up = up ? [up[0], d] : [d, d];
  }
  return up;
}

function twilightGradient(night: ReturnType<typeof nightOf>, pos: (d: Date | null | undefined) => number | null) {
  const c = { day: "#3a3428", civil: "#2a2622", nautical: "#1b1a18", astro: "#121211", night: "#0b0b0a" };
  const p = (d: Date | null | undefined, fb: number) => pos(d) ?? fb;
  return `linear-gradient(90deg, ${c.day} 0%, ${c.civil} ${p(night.civil[0], 4)}%, ${c.nautical} ${p(night.nautical[0], 8)}%, ${c.night} ${p(night.astro[0], 12)}%, ${c.night} ${p(night.astro[1], 88)}%, ${c.nautical} ${p(night.nautical[1], 92)}%, ${c.civil} ${p(night.civil[1], 96)}%, ${c.day} 100%)`;
}

function MoonIcon({ phase, size = 40 }: { phase: number; size?: number }) {
  // Terminador como elipse: fase 0 = nueva, 180 = llena. Creciente ilumina el lado derecho (hemisferio norte).
  const r = size / 2 - 1;
  const k = Math.cos((phase * Math.PI) / 180); // 1 nueva → −1 llena
  const waxing = phase < 180;
  const rx = Math.abs(k) * r;
  const lit = waxing
    ? `M ${size / 2} 1 A ${r} ${r} 0 0 1 ${size / 2} ${size - 1} A ${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${size / 2} 1`
    : `M ${size / 2} 1 A ${r} ${r} 0 0 0 ${size / 2} ${size - 1} A ${rx} ${r} 0 0 ${k > 0 ? 1 : 0} ${size / 2} 1`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="#25241f" />
      <path d={lit} fill="#ecebe6" />
    </svg>
  );
}

type Track = { name: string; pts: { t: number; el: number; az: number }[] };

function PassHero({ p, now, onShow }: { p: Pass & { name: string; norad: number }; now: number; onShow: () => void }) {
  const startMs = p.start.getTime() - now, inProgress = startMs <= 0;
  const cd = splitCountdown(Math.max(0, startMs));
  const crewed = p.norad === 25544 || p.norad === 48274;
  const parts: [number, string][] = cd.d ? [[cd.d, "d"], [cd.h, "h"], [cd.m, "min"]] : [[cd.h, "h"], [cd.m, "min"], [cd.s, "s"]];
  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,#ff5b1f1a,transparent_60%)]" />
      <div className="relative grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
        <div className="min-w-0">
          <p className="label flex items-center gap-1.5 !text-accent">{crewed ? <SatIcon className="size-3.5" /> : <Eye className="size-3.5" />} {inProgress ? "Pasando ahora sobre ti" : "Próximo paso visible"}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{prettyName(p.name)}</h2>
          <p className="mt-1.5 text-sm text-fg-muted">
            A las <span className="num text-fg">{hm(p.start)}</span>: aparece por el <span className="text-fg">{dir(p.azStart)}</span>, sube hasta <span className="num text-fg">{Math.round(p.maxEl)}°</span> hacia el {dir(p.azPeak)} y se pierde por el {dir(p.azEnd)} · {Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 60_000))} min
          </p>
          <button onClick={onShow} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"><Telescope className="size-4" /> Ver su recorrido en el cielo</button>
        </div>
        {!inProgress && (
          <div className="num flex items-end gap-2" aria-label="Cuenta regresiva">
            {parts.map(([v, l], i) => (
              <span key={l} className="flex items-end gap-2">
                {i > 0 && <span className="mb-4 text-2xl text-fg-dim">:</span>}
                <span className="flex flex-col items-center"><span className="text-4xl leading-none md:text-5xl">{String(v).padStart(2, "0")}</span><span className="label mt-1.5">{l}</span></span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Dome({ o, t, track }: { o: Observer; t: Date; track?: Track | null }) {
  const S = 400, C = S / 2, R = 180;
  const xy = (alt: number, az: number) => {
    const r = ((90 - alt) / 90) * R, a = (az * Math.PI) / 180;
    return [C - r * Math.sin(a), C - r * Math.cos(a)] as const;
  };
  const bodies = useMemo(() => {
    const list: { name: string; alt: number; az: number; kind: "planet" | "moon" | "sun" }[] = [];
    for (const [b, name] of PLANETS) list.push({ name, ...altAz(b, t, o), kind: "planet" });
    list.push({ name: "Luna", ...altAz(Body.Moon, t, o), kind: "moon" });
    list.push({ name: "Sol", ...altAz(Body.Sun, t, o), kind: "sun" });
    return list.filter((x) => x.alt > -2);
  }, [o, t]);
  const stars = useMemo(() => STARS.map(([name, ra, dec, mag]) => ({ name, mag, ...Horizon(t, o, ra, dec, "normal") })).filter((s) => s.altitude > 0), [o, t]);
  const sunAlt = altAz(Body.Sun, t, o).alt;
  const bg = sunAlt > 0 ? "#2b281f" : sunAlt > -6 ? "#1f1d19" : sunAlt > -12 ? "#161513" : "#0e0e0d";
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[460px]" role="img" aria-label="Cúpula del cielo con planetas, Luna y estrellas brillantes">
      <circle cx={C} cy={C} r={R} fill={bg} stroke="var(--color-line-strong)" />
      {[30, 60].map((a) => <circle key={a} cx={C} cy={C} r={((90 - a) / 90) * R} fill="none" stroke="var(--color-line)" strokeDasharray="2 4" />)}
      {[["N", 0], ["E", 90], ["S", 180], ["O", 270]].map(([l, az]) => {
        const [x, y] = xy(-9, az as number);
        return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-fg-muted)">{l}</text>;
      })}
      {stars.map((s) => {
        const [x, y] = xy(s.altitude, s.azimuth);
        return (
          <g key={s.name}>
            <circle cx={x} cy={y} r={Math.max(0.8, 2.6 - s.mag * 0.8)} fill="#ecebe6" opacity={sunAlt > -6 ? 0.25 : 0.85}><title>{s.name}</title></circle>
            {s.mag < 0.6 && sunAlt < -6 && <text x={x + 4} y={y - 3} fontSize={9} fill="var(--color-fg-dim)">{s.name}</text>}
          </g>
        );
      })}
      {track && <PassPath track={track} t={t} xy={xy} />}
      {bodies.map((b) => {
        const [x, y] = xy(Math.max(0, b.alt), b.az);
        const fill = b.kind === "sun" ? "#ffb347" : b.kind === "moon" ? "#ecebe6" : "#ff8a5c";
        return (
          <g key={b.name}>
            <circle cx={x} cy={y} r={b.kind === "planet" ? 4 : 7} fill={fill} stroke="var(--color-surface)" strokeWidth={1.5} />
            <text x={x + 8} y={y + 4} fontSize={11} fontWeight={500} fill="var(--color-fg)">{b.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PassPath({ track, t, xy }: { track: Track; t: Date; xy: (alt: number, az: number) => readonly [number, number] }) {
  const vis = track.pts.filter((p) => p.el > 0);
  if (vis.length < 2) return null;
  const d = vis.map((p, i) => { const [x, y] = xy(p.el, p.az); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const [ex, ey] = xy(vis[vis.length - 1].el, vis[vis.length - 1].az);
  const [px, py] = xy(vis[vis.length - 2].el, vis[vis.length - 2].az);
  const a = Math.atan2(ey - py, ex - px);
  const peak = vis.reduce((m, p) => (p.el > m.el ? p : m), vis[0]);
  const [kx, ky] = xy(peak.el, peak.az);
  const cur = track.pts.reduce((m, p) => (Math.abs(p.t - t.getTime()) < Math.abs(m.t - t.getTime()) ? p : m), track.pts[0]);
  const [nx, ny] = xy(Math.max(0, cur.el), cur.az);
  return (
    <g>
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" />
      <path d={`M${ex} ${ey} l${-10 * Math.cos(a - 0.5)} ${-10 * Math.sin(a - 0.5)} M${ex} ${ey} l${-10 * Math.cos(a + 0.5)} ${-10 * Math.sin(a + 0.5)}`} stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <text x={kx + 8} y={ky - 8} fontSize={11.5} fontWeight={600} fill="var(--color-accent)">{track.name}</text>
      {cur.el > 0 && <circle cx={nx} cy={ny} r={5} fill="#fff" stroke="var(--color-accent)" strokeWidth={2} />}
    </g>
  );
}
