"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, ArrowDown, ChevronLeft, ChevronRight, Map, Rocket, Building2, BarChart3, Orbit, CloudSun, Radio, Search,
  GraduationCap, Microscope, Telescope,
} from "lucide-react";
import type { LandingData } from "@/lib/data/landing";
import type { GlobeHandle, GlobeTarget } from "./GlobeStage";
import { Logo } from "@/components/shell/Logo";
import { Countdown } from "@/components/launch/Countdown";
import { StatusBadge, StatusDot } from "@/components/launch/StatusBadge";
import { Flag } from "@/components/ui/Flag";
import { countryName, isPrecise } from "@/lib/format";
import { typeLabel } from "@/lib/data/entities-labels";
import { useLive } from "@/lib/hooks/live";
import { WatchButton } from "@/components/launch/LiveExtras";

const GlobeStage = dynamic(() => import("./GlobeStage").then((m) => m.GlobeStage), { ssr: false });
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const nf = new Intl.NumberFormat("es");
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es")} %`;

/*
 * Portada con scroll NATIVO (nunca se bloquea ni se secuestra la rueda):
 *  · el navegador asienta la página en cada sección con CSS scroll-snap (física nativa, sin código que pelee con la inercia);
 *  · "El planeta" se queda fija mientras el scroll recorre las bases (un punto de encaje por base);
 *  · "Menos conocidos" se queda fija mientras el scroll vertical desplaza la galería en horizontal, 1:1;
 *  · el menú: a la sección contigua con desplazamiento suave; a una lejana con un corte limpio (sin "cámara rápida");
 *  · nada aparece con retraso al hacer scroll: el movimiento lo aportan el globo y el propio desplazamiento.
 */
const SECTIONS = [
  { id: "ahora", label: "Ahora" },
  { id: "problema", label: "El problema" },
  { id: "planeta", label: "El planeta" },
  { id: "plataforma", label: "La plataforma" },
  { id: "visibles", label: "Menos conocidos" },
  { id: "datos", label: "Los datos" },
  { id: "empezar", label: "Empezar" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// Puesta en escena del globo por sección: posición horizontal y atenuación para que el texto mande
const GLOBE: Record<SectionId, { shift: number; dim: number }> = {
  ahora: { shift: 0.55, dim: 0 },
  problema: { shift: 0, dim: 0.6 },
  planeta: { shift: -0.5, dim: 0 },
  plataforma: { shift: 0, dim: 0.8 },
  visibles: { shift: -0.55, dim: 0.78 },
  datos: { shift: 0.55, dim: 0.3 },
  empezar: { shift: 0, dim: 0.45 },
};

const SOURCE_KINDS = ["Webs oficiales", "Redes sociales", "Notas de prensa", "Transmisiones", "Foros", "Bases de datos", "Portales especializados", "Boletines"];
const seeded = (i: number) => { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); };

export function Landing({ data }: { data: LandingData }) {
  const root = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const cutRef = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<SectionId>("ahora");
  const currentRef = useRef<SectionId>("ahora");
  const [stop, setStop] = useState(0);
  const stopRef = useRef(0);
  const [galleryRun, setGalleryRun] = useState(0); // recorrido horizontal de la galería (px)
  const scatter = useRef<gsap.core.Timeline | null>(null);
  const counters = useRef<gsap.core.Tween[]>([]);
  const played = useRef<Set<SectionId>>(new Set());
  const reduce = useRef(false);
  const live = useLive();
  const n = live?.next ?? data.next; // tarjeta del próximo lanzamiento: en vivo, sin recargar
  const c = data.conc;
  const fragments = [...SOURCE_KINDS, ...data.fragments].slice(0, 24);
  const nStops = data.stops.length;

  const applyGlobe = useCallback((id: SectionId, stopIdx: number) => {
    const g = GLOBE[id];
    const st = data.stops[stopIdx];
    const target: GlobeTarget = id === "planeta" && st ? { lat: st.lat, lng: st.lng, dist: 2.6, shiftX: -0.5, dim: 0 } : null;
    globe.current?.setTarget(target);
    globe.current?.setShift(g.shift);
    if (dimRef.current) gsap.to(dimRef.current, { opacity: g.dim, duration: reduce.current ? 0 : 0.8, ease: "power2.out", overwrite: true });
  }, [data.stops]);

  /** Desplazamiento a una sección: contigua → suave; lejana → corte limpio (fundido breve, salto, fundido). */
  const goTo = useCallback((id: SectionId, offset = 0) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY + offset;
    const from = SECTIONS.findIndex((s) => s.id === currentRef.current), to = SECTIONS.findIndex((s) => s.id === id);
    if (reduce.current || Math.abs(to - from) <= 1 || !cutRef.current) {
      window.scrollTo({ top: y, behavior: reduce.current ? "auto" : "smooth" });
      return;
    }
    const cut = cutRef.current;
    gsap.timeline()
      .to(cut, { opacity: 1, duration: 0.18, ease: "power1.in" })
      .add(() => window.scrollTo({ top: y, behavior: "auto" }))
      .to(cut, { opacity: 0, duration: 0.35, ease: "power1.out" }, "+=0.06");
  }, []);

  // Recorrido horizontal de la galería = ancho que sobra (se recalcula al cambiar el tamaño)
  useEffect(() => {
    const measure = () => {
      const t = track.current;
      if (t) setGalleryRun(Math.max(0, t.scrollWidth - t.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, []);

  useIso(() => {
    gsap.registerPlugin(ScrollTrigger);
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    applyGlobe("ahora", 0);

    const ctx = gsap.context(() => {
      if (!reduce.current) gsap.from("[data-hero] > *", { y: 20, opacity: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" });

      // Sección actual → globo, menú y animaciones propias
      SECTIONS.forEach(({ id }) => ScrollTrigger.create({
        trigger: `#${id}`, start: "top 55%", end: "bottom 45%",
        onToggle: (st) => {
          if (!st.isActive) return;
          currentRef.current = id;
          setCurrent(id);
          applyGlobe(id, stopRef.current);
        },
      }));

      // El planeta: el progreso dentro de su tramo elige la base (discreta; el encaje nativo la asienta)
      ScrollTrigger.create({
        trigger: "#planeta", start: "top top", end: "bottom bottom",
        onUpdate: (st) => {
          const k = Math.min(nStops - 1, Math.max(0, Math.round(st.progress * (nStops - 1))));
          if (k !== stopRef.current) {
            stopRef.current = k;
            setStop(k);
            if (currentRef.current === "planeta") applyGlobe("planeta", k);
          }
        },
      });

      // Menos conocidos: la galería se desplaza en horizontal 1:1 con el scroll vertical
      ScrollTrigger.create({
        trigger: "#visibles", start: "top top", end: "bottom bottom",
        onUpdate: (st) => {
          const t = track.current, run = t ? t.scrollWidth - t.clientWidth : 0;
          if (galleryRef.current) gsap.set(galleryRef.current, { x: -st.progress * run });
        },
      });

      // Convergencia de fuentes: solo cuando "El problema" está asentada en pantalla
      const frags = gsap.utils.toArray<HTMLElement>("[data-frag]");
      if (reduce.current) {
        gsap.set(frags, { opacity: 0 });
        gsap.set("[data-hub], [data-pillars]", { opacity: 1, scale: 1 });
      } else {
        gsap.set("[data-hub]", { opacity: 0, scale: 0.85 });
        gsap.set("[data-pillars]", { opacity: 0 });
        gsap.set(frags, { opacity: 0, scale: 0.85 });
        scatter.current = gsap.timeline({ paused: true })
          .to(frags, { opacity: 1, scale: 1, stagger: 0.035, duration: 0.45, ease: "power2.out" })
          .to(frags, { left: "50%", top: "50%", xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0, stagger: 0.018, duration: 0.75, ease: "power3.in" }, "+=0.8")
          .to("[data-hub]", { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.5)" }, "-=0.3")
          .to("[data-pillars]", { opacity: 1, duration: 0.45, ease: "power2.out" }, "-=0.1");
      }
      counters.current = gsap.utils.toArray<HTMLElement>("[data-count]").map((el) => {
        const to = Number(el.dataset.count), o = { v: 0 };
        if (reduce.current) el.textContent = to.toLocaleString("es");
        return gsap.to(o, { v: to, duration: 1.2, ease: "power2.out", paused: true, onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("es"); } });
      });
    }, root);

    // "Asentada": el scroll terminó con la sección ocupando la pantalla
    const settledIn = (id: string) => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return !!r && r.top <= 8 && r.bottom >= window.innerHeight - 8;
    };
    const onSettle = () => {
      if (scatter.current) {
        if (settledIn("problema")) { if (!played.current.has("problema")) { played.current.add("problema"); scatter.current.play(); } }
        else if (played.current.has("problema") || currentRef.current !== "ahora") scatter.current.progress(1); // pasó de largo: queda completa
      }
      if (settledIn("datos") && !played.current.has("datos")) { played.current.add("datos"); counters.current.forEach((t) => t.play()); }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(onSettle, 160); };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (location.hash) requestAnimationFrame(() => { goTo(location.hash.slice(1) as SectionId); });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      ctx.revert();
    };
  }, []);

  // Al cambiar el alto de la galería, ScrollTrigger recalcula sus tramos
  useEffect(() => { ScrollTrigger.refresh(); }, [galleryRun]);

  const goStop = (i: number) => {
    const k = Math.max(0, Math.min(nStops - 1, i));
    const el = document.getElementById("planeta");
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + k * window.innerHeight, behavior: reduce.current ? "auto" : "smooth" });
  };
  const nudgeGallery = (dir: 1 | -1) => window.scrollBy({ top: dir * Math.min(600, window.innerWidth * 0.6), behavior: "smooth" });
  const s = data.stops[stop];
  // Puntos de encaje dentro de la galería: cada ~520 px de recorrido
  const gallerySnaps = Math.max(0, Math.floor(galleryRun / 520));

  return (
    <div ref={root} data-landing className="relative bg-bg text-fg">
      <div className="pointer-events-none fixed inset-0 z-0"><GlobeStage ref={globe} pads={data.pads} /></div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-bg)_95%)]" />
      <div ref={dimRef} className="pointer-events-none fixed inset-0 z-0 bg-bg opacity-0" />
      <div ref={cutRef} className="pointer-events-none fixed inset-0 z-40 bg-bg opacity-0" />

      {/* Encabezado con capítulos */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-6 bg-gradient-to-b from-bg via-bg/85 to-transparent px-5 pt-4 pb-8 md:px-8">
        <button onClick={() => goTo("ahora")} aria-label="Inicio"><Logo /></button>
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Capítulos">
          {SECTIONS.slice(0, 6).map((sec, i) => (
            <button key={sec.id} onClick={() => goTo(sec.id)} aria-current={current === sec.id ? "location" : undefined}
              className={clsx("rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors", current === sec.id ? "bg-surface-2 text-fg" : "text-fg-dim hover:text-fg")}>
              <span className="num mr-1.5 text-[10.5px] text-fg-dim">{String(i + 1).padStart(2, "0")}</span>{sec.label}
            </button>
          ))}
        </nav>
        <Link href="/panel" className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-bg/60 px-3.5 text-sm backdrop-blur hover:bg-surface-2 lg:ml-0">
          Ir a la plataforma <ArrowRight className="size-4" />
        </Link>
      </header>

      <main className="relative z-10">
        {/* 01 · AHORA */}
        <section id="ahora" data-snap className="flex min-h-dvh flex-col">
          <div data-hero className="flex max-w-2xl flex-1 flex-col justify-center px-5 pt-24 pb-6 md:px-12 lg:px-20">
            <Eyebrow n="01" text="Monitor mundial de lanzamientos" />
            <h1 className="text-[clamp(2.1rem,min(4.4vw,7.2vh),4.4rem)] leading-[1.04] font-semibold tracking-tight">Todo lo que despega en el planeta, en un solo lugar.</h1>
            <p className="mt-4 max-w-lg text-fg-muted md:text-[17px] [@media(max-height:700px)]:hidden">
              {nf.format(data.pads.length)} plataformas en {nf.format(data.kpis.countries)} países y {nf.format(data.activeOperators)} operadores activos. Agencias gigantes y empresas que casi nadie conoce, con datos públicos.
            </p>
            {n && (
              <Link href={`/lanzamientos/${n.slug}`} className="mt-6 flex max-w-lg flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface/80 p-4 backdrop-blur transition-colors hover:border-line-strong">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2"><span className="label !text-accent">Próximo lanzamiento</span><StatusBadge key={n.statusAbbrev} abbrev={n.statusAbbrev} className="animate-status-pop" /></div>
                  <p className="truncate font-medium">{n.missionName ?? n.name}</p>
                  <p className="truncate text-xs text-fg-dim"><Flag code={n.countryCode} /> {n.rocketName} · {n.providerName}</p>
                </div>
                <Countdown net={n.net} precision={n.netPrecision} size="md" status={n.statusAbbrev} />
              </Link>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {n && <WatchButton watch={live?.next?.watch} net={n.net} webcastLive={n.webcastLive} className="h-11" />}
              <Link href="/panel" className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 font-medium text-bg hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
              <button onClick={() => goTo("problema")} className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-5 backdrop-blur hover:bg-surface-2">Por qué existe <ArrowDown className="size-4" /></button>
            </div>
          </div>
          <div className="shrink-0 overflow-hidden border-y border-line bg-bg/70 py-3 backdrop-blur [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-8 pr-8 hover:[animation-play-state:paused]">
              {[...data.upcoming, ...data.upcoming].map((l, i) => (
                <Link key={l.slug + i} href={`/lanzamientos/${l.slug}`} className="flex items-center gap-2.5 text-[13px] whitespace-nowrap text-fg-muted hover:text-fg">
                  <StatusDot abbrev={l.status} /><Flag code={l.country} />
                  <span className="text-fg">{l.name}</span>
                  <span className="text-fg-dim">{l.rocket} · {l.provider}</span>
                  {isPrecise(l.precision) ? <Countdown net={l.net} precision={l.precision} size="sm" status={l.status} /> : <span className="num text-xs text-fg-dim">NET</span>}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 02 · EL PROBLEMA — una pantalla: convergencia y cifras */}
        <section id="problema" data-snap className="flex h-dvh min-h-[700px] flex-col px-5 pt-24 pb-6 md:px-12">
          <div className="text-center">
            <Eyebrow n="02" text="El problema" center />
            <h2 className="mx-auto max-w-3xl text-[clamp(1.7rem,min(4vw,6vh),3rem)] leading-tight font-semibold tracking-tight">La información aeroespacial está dispersa.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-fg-muted md:text-base">Decenas de agencias, empresas, webs y redes, cada una con su parte de la historia.</p>
          </div>
          <div className="relative min-h-[190px] flex-1">
            {fragments.map((f, i) => (
              <span key={f + i} data-frag className="absolute rounded-md border border-line bg-surface/85 px-3 py-1.5 font-mono text-xs whitespace-nowrap text-fg-muted backdrop-blur"
                style={{ left: `${2 + seeded(i) * 84}%`, top: `${8 + seeded(i + 50) * 80}%` }}>{f}</span>
            ))}
            <div data-hub className="absolute top-1/2 left-1/2 w-[min(88vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-accent/40 bg-surface/95 p-4 shadow-[0_0_80px_-20px_rgba(255,91,31,.5)] backdrop-blur md:p-5">
              <div className="mb-2 flex items-center gap-2"><Logo compact /><span className="label !text-accent">Un único lugar</span></div>
              <p className="font-medium md:text-lg">Próximos lanzamientos, mapa, organizaciones, histórico, clima, transmisiones y órbitas.</p>
              <p className="mt-1.5 text-xs text-fg-muted md:text-sm">Sincronizado automáticamente desde fuentes públicas.</p>
            </div>
          </div>
          <div data-pillars className="mx-auto grid w-full max-w-6xl grid-cols-3 overflow-hidden rounded-lg border border-line bg-bg/75 backdrop-blur">
            <Pillar k="Dispersa" v={nf.format(data.activeOperators)} unit="operadores activos" text="publican su actividad cada uno en su propio canal, con formatos y horarios distintos." />
            <Pillar k="Concentrada" v={c ? pct(c.top3) : "—"} unit="en solo 3 operadores" text={`de los lanzamientos de los últimos 12 meses${data.topOperator && c ? `; ${data.topOperator} lidera con ${pct(c.top1)}` : ""}.`} />
            <Pillar k="Invisible" v={nf.format(data.lesserCount)} unit="organizaciones activas" text="suman menos de 25 lanzamientos en toda su historia y casi no aparecen en los medios." />
          </div>
        </section>

        {/* 03 · EL PLANETA — tramo de N pantallas; el contenido queda fijo y el scroll recorre las bases */}
        <section id="planeta" className="relative" style={{ height: `${Math.max(1, nStops) * 100}dvh` }}>
          {Array.from({ length: Math.max(1, nStops) }, (_, i) => (
            <div key={i} data-snap aria-hidden className="pointer-events-none absolute inset-x-0 h-dvh" style={{ top: `${i * 100}dvh` }} />
          ))}
          <div className="sticky top-0 flex h-dvh flex-col justify-between gap-6 px-5 pt-24 pb-8 md:flex-row md:items-center md:px-12 lg:px-20">
            <div className="md:max-w-sm">
              <Eyebrow n="03" text="El planeta" />
              <h2 className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Un recorrido por las bases que lanzan hoy.</h2>
              <ol className="mt-6 hidden space-y-1 md:block" aria-label="Bases">
                {data.stops.map((st, i) => (
                  <li key={st.id}>
                    <button onClick={() => goStop(i)} className={clsx("flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors", stop === i ? "bg-surface-2/80 text-fg" : "text-fg-dim hover:text-fg")}>
                      <span className={clsx("h-px transition-all duration-300", stop === i ? "w-6 bg-accent" : "w-3 bg-line-strong")} />
                      <span className="num text-[11px]">{String(i + 1).padStart(2, "0")}</span>{st.region}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {s && (
              <div className="w-full md:w-[380px]">
                <div key={s.id} className="animate-fade-in rounded-lg border border-line bg-surface/90 p-5 backdrop-blur">
                  <p className="label mb-1"><span className="num mr-2 text-accent">{String(stop + 1).padStart(2, "0")}/{String(nStops).padStart(2, "0")}</span>{s.region}</p>
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{s.name}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
                    <div className="bg-surface p-3"><p className="label">Lanzamientos</p><p className="num mt-1 text-2xl">{nf.format(s.total)}</p></div>
                    <div className="bg-surface p-3"><p className="label">Programados</p><p className="num mt-1 text-2xl text-accent">{s.upcoming}</p></div>
                  </div>
                  {s.operators.length > 0 && <p className="mt-3 text-xs text-fg-dim">Operan aquí: {s.operators.join(" · ")}</p>}
                  <Link href={`/bases/${s.id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">Ver la base <ArrowRight className="size-4" /></Link>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={() => goStop(stop - 1)} aria-label="Base anterior" className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-bg/60 backdrop-blur hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
                    <button onClick={() => goStop(stop + 1)} aria-label="Base siguiente" className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-bg/60 backdrop-blur hover:bg-surface-2"><ChevronRight className="size-4" /></button>
                  </div>
                  <div className="flex gap-1.5">
                    {data.stops.map((st, i) => <button key={st.id} onClick={() => goStop(i)} aria-label={st.region} className={clsx("h-1 rounded-full transition-all duration-300", stop === i ? "w-6 bg-accent" : "w-2 bg-line-strong")} />)}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-fg-dim">Sigue bajando para recorrer las bases</p>
              </div>
            )}
          </div>
        </section>

        {/* 04 · LA PLATAFORMA */}
        <section id="plataforma" data-snap className="flex min-h-dvh items-center">
          <div className="mx-auto w-full max-w-6xl px-5 pt-24 pb-8 md:px-12">
            <Eyebrow n="04" text="La plataforma" />
            <h2 className="max-w-2xl text-[clamp(1.6rem,min(3.6vw,5.5vh),2.8rem)] leading-tight font-semibold tracking-tight">Consultar, explorar e investigar, sin saltar de sitio en sitio.</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Feature href="/panel" icon={Rocket} title="Panel en vivo" text="Próximo lanzamiento, cuenta regresiva y resultados recientes." />
              <Feature href="/mapa" icon={Map} title="Mapa mundial" text="Plataformas del planeta, filtros y vista de globo."><MiniDots pads={data.pads} /></Feature>
              <Feature href="/lanzamientos" icon={Search} title="Explorador" text="Filtros por operador, país, cohete, base y fecha. Ctrl+K." />
              <Feature href="/estadisticas" icon={BarChart3} title="Estadísticas" text="Series históricas y un índice de concentración (HHI)." />
              <Feature href="/satelites" icon={Orbit} title="Satélites" text="Constelaciones en tiempo real y «¿cuándo pasa sobre mí?»." />
              <Feature href="/lanzamientos" icon={Radio} title="Transmisiones" text="Webcasts oficiales diferenciados de los independientes." />
              <Feature href="/bases" icon={CloudSun} title="Clima" text="Condiciones y pronóstico a la hora prevista, como contexto." />
              <Feature href="/organizaciones" icon={Building2} title="Organizaciones" text="Agencias y empresas de todo el mundo, sin favoritismos." />
            </div>
          </div>
        </section>

        {/* 05 · MENOS CONOCIDOS — fija mientras el scroll vertical desplaza la galería en horizontal */}
        <section id="visibles" className="relative" style={{ height: `calc(100dvh + ${galleryRun}px)` }}>
          <div data-snap aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-dvh" />
          {Array.from({ length: gallerySnaps }, (_, i) => (
            <div key={i} data-snap aria-hidden className="pointer-events-none absolute inset-x-0 h-dvh" style={{ top: `${((i + 1) * galleryRun) / (gallerySnaps + 1)}px` }} />
          ))}
          <div data-snap aria-hidden className="pointer-events-none absolute inset-x-0 h-dvh" style={{ top: `${galleryRun}px` }} />
          <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden pt-24 pb-8">
            <div className="flex flex-wrap items-end justify-between gap-4 px-5 md:px-12 lg:px-20">
              <div>
                <Eyebrow n="05" text="Menos conocidos" />
                <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">También lanzan. Casi nadie lo cuenta.</h2>
              </div>
              <div className="hidden gap-2 md:flex">
                <button onClick={() => nudgeGallery(-1)} aria-label="Anteriores" className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-bg/60 hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
                <button onClick={() => nudgeGallery(1)} aria-label="Siguientes" className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-bg/60 hover:bg-surface-2"><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <div ref={track} className="mt-8 overflow-hidden px-5 md:px-12 lg:px-20">
              <div ref={galleryRef} className="flex w-max gap-3 will-change-transform">
                {data.lesser.map((o) => (
                  <Link key={o.id} href={`/organizaciones/${o.id}`} className="group flex min-h-[260px] w-[250px] shrink-0 flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-accent/50 md:w-[290px]">
                    <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-white/95 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.logo && <img src={o.logo} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />}
                    </div>
                    <p className="mt-4 text-lg leading-snug font-medium">{o.name}</p>
                    <p className="mt-1 mb-4 text-xs text-fg-dim">{o.countries.slice(0, 2).map((cc) => <span key={cc} className="mr-2"><Flag code={cc} /> {countryName(cc)}</span>)}· {typeLabel(o.type)}</p>
                    <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
                      <div className="bg-surface p-2.5"><p className="label">Total</p><p className="num text-xl">{o.total}</p></div>
                      <div className="bg-surface p-2.5"><p className="label">Próximos</p><p className="num text-xl text-accent">{o.upcoming}</p></div>
                    </div>
                  </Link>
                ))}
                <Link href="/organizaciones?orden=menos" className="flex min-h-[260px] w-[250px] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong p-5 text-center text-sm text-fg-muted hover:text-fg md:w-[290px]">
                  Ver las {nf.format(data.lesserCount)} organizaciones <ArrowRight className="mt-2 size-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 06 · LOS DATOS */}
        <section id="datos" data-snap className="flex min-h-dvh flex-col justify-center px-5 pt-24 pb-8 md:px-12 lg:px-20">
          <div className="max-w-3xl">
            <Eyebrow n="06" text="Los datos" />
            <h2 className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">Datos reales, fuentes abiertas, nada inventado.</h2>
            <p className="mt-4 max-w-2xl text-fg-muted">Si una fuente no ofrece un dato, la plataforma no lo muestra. Sin telemetría simulada ni predicciones de cancelación.</p>
          </div>
          <div className="mt-8 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
            {([
              ["Programados", data.kpis.upcoming],
              ["Operadores activos", data.activeOperators],
              ["Países con bases activas", data.kpis.countries],
              ["Índice HHI (12 m)", c?.hhi ?? 0],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k} className="bg-surface/90 p-5 backdrop-blur">
                <p className="label">{k}</p>
                <p className="num mt-2 text-4xl" data-count={v}>0</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex max-w-5xl flex-wrap gap-2">
            {["Launch Library 2", "OpenStreetMap", "Open-Meteo", "CelesTrak", "Spaceflight News API", "Natural Earth", "Gemini (traducción)"].map((x) => (
              <span key={x} className="rounded-md border border-line bg-surface/80 px-3 py-1.5 font-mono text-xs text-fg-muted backdrop-blur">{x}</span>
            ))}
          </div>
        </section>

        {/* 07 · EMPEZAR + pie */}
        <section id="empezar" data-snap className="flex min-h-dvh flex-col">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pt-24 pb-6 text-center md:px-12">
            <h2 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">Deja de buscar en diez sitios distintos.</h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/panel" className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 font-medium text-black hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
              <Link href="/acerca" className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-6 backdrop-blur hover:bg-surface-2">Acerca del proyecto</Link>
            </div>
            <div className="mt-10 grid gap-3 text-left md:grid-cols-3">
              <Audience icon={GraduationCap} who="Estudiantes" text="Cuándo, dónde y quién lanza, con glosario de estados." />
              <Audience icon={Microscope} who="Investigadores" text="Histórico, filtros compartibles, estadísticas y fuentes citadas." />
              <Audience icon={Telescope} who="Aficionados" text="Cuenta regresiva, transmisiones, calendario y satélites." />
            </div>
          </div>
          <footer className="border-t border-line bg-bg/90 px-5 py-6 backdrop-blur md:px-12 lg:px-20">
            <div className="mx-auto grid max-w-6xl gap-6 text-sm md:grid-cols-4">
              <div className="md:col-span-2">
                <Logo />
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-fg-dim">
                  Proyecto de investigación de <span className="text-fg-muted">Ana Isabel Ruiz Gómez</span> y <span className="text-fg-muted">Yeslei Vannesa Mora Gómez</span>,
                  Programa de Ingeniería Aeronáutica · Universidad Pontificia Bolivariana.
                </p>
                <p className="mt-2 text-[11px] text-fg-dim">Desarrollo de software: Ing. Ismael Paulino.</p>
              </div>
              <FooterCol title="Plataforma" links={[["Panel", "/panel"], ["Mapa", "/mapa"], ["Lanzamientos", "/lanzamientos"], ["Satélites", "/satelites"]]} />
              <FooterCol title="Información" links={[["Acerca del proyecto", "/acerca"], ["Metodología", "/metodologia"], ["Estadísticas", "/estadisticas"], ["Noticias", "/noticias"]]} />
            </div>
            <p className="mx-auto mt-5 max-w-6xl text-[11px] text-fg-dim">
              Datos: The Space Devs (Launch Library 2, Spaceflight News API) · Cartografía © OpenStreetMap contributors · Clima: Open-Meteo · Órbitas: CelesTrak · Continentes: Natural Earth.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}

function Eyebrow({ n, text, center }: { n: string; text: string; center?: boolean }) {
  return (
    <p className={clsx("label mb-4 flex items-center gap-3 !text-accent", center && "justify-center")}>
      <span className="num text-fg-dim">{n}</span><span className="h-px w-8 bg-accent/60" />{text}
    </p>
  );
}

function Pillar({ k, v, unit, text }: { k: string; v: string; unit: string; text: string }) {
  return (
    <div className="border-l border-line p-3 first:border-l-0 md:p-5">
      <p className="label mb-1.5 md:mb-2">{k}</p>
      <p className="num text-2xl md:text-4xl">{v}</p>
      <p className="mt-0.5 text-xs text-fg md:mt-1 md:text-sm">{unit}</p>
      <p className="mt-1.5 hidden text-sm text-fg-muted md:block">{text}</p>
    </div>
  );
}

function Feature({ href, icon: Icon, title, text, children }: { href: string; icon: typeof Map; title: string; text: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="group flex flex-col rounded-lg border border-line bg-surface/90 p-4 backdrop-blur transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-md border border-line bg-surface-2 text-accent"><Icon className="size-4" strokeWidth={1.75} /></span>
        <ArrowRight className="size-4 -translate-x-1 text-fg-dim opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <h3 className="mt-3 text-[15px] font-medium">{title}</h3>
      <p className="mt-1 text-[13px] leading-snug text-fg-muted">{text}</p>
      {children}
    </Link>
  );
}

function Audience({ icon: Icon, who, text }: { icon: typeof Map; who: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface/70 p-4 backdrop-blur">
      <Icon className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={1.5} />
      <div><p className="font-medium">{who}</p><p className="mt-0.5 text-sm text-fg-muted">{text}</p></div>
    </div>
  );
}

function MiniDots({ pads }: { pads: LandingData["pads"] }) {
  const W = 360, H = 120, TOP = 78, SPAN = 140;
  const x = (lng: number) => ((lng + 180) / 360) * W;
  const y = (lat: number) => ((TOP - lat) / SPAN) * H;
  const [land, setLand] = useState<string | null>(null);
  // Contornos de Natural Earth (dominio público), proyección equirectangular
  useEffect(() => {
    let alive = true;
    Promise.all([import("world-atlas/land-110m.json"), import("topojson-client")]).then(([m, tj]) => {
      const topo = (m.default ?? m) as unknown as Parameters<typeof tj.feature>[0];
      const fc = tj.feature(topo, (topo as unknown as { objects: { land: Parameters<typeof tj.feature>[1] } }).objects.land) as unknown as GeoJSON.FeatureCollection;
      let d = "";
      for (const f of fc.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
        for (const poly of polys) for (const ring of poly) d += "M" + ring.map(([lo, la]) => `${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join("L") + "Z";
      }
      if (alive) setLand(d);
    });
    return () => { alive = false; };
  }, []);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full rounded-md border border-line bg-bg/60" aria-hidden>
      {land && <path d={land} fill="var(--color-surface-3)" stroke="var(--color-line-strong)" strokeWidth={0.4} />}
      {pads.map((p, i) => (
        <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r={p.upcoming ? 2.4 : 1.4} fill={p.upcoming ? "var(--color-accent)" : "var(--color-fg-dim)"} opacity={p.upcoming ? 0.95 : 0.6} />
      ))}
    </svg>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="label mb-3">{title}</p>
      <ul className="space-y-2">{links.map(([l, h]) => <li key={h}><Link href={h} className="text-fg-muted hover:text-fg">{l}</Link></li>)}</ul>
    </div>
  );
}
