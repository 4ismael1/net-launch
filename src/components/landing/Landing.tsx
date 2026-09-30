"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  ArrowRight, ArrowDown, Map, Rocket, Building2, BarChart3, Orbit, CloudSun, Radio, Search, GraduationCap, Microscope, Telescope,
} from "lucide-react";
import type { LandingData } from "@/lib/data/landing";
import type { GlobeHandle } from "./GlobeStage";
import { Logo } from "@/components/shell/Logo";
import { Countdown } from "@/components/launch/Countdown";
import { StatusBadge, StatusDot } from "@/components/launch/StatusBadge";
import { Flag } from "@/components/ui/Flag";
import { countryName, isPrecise } from "@/lib/format";
import { typeLabel } from "@/lib/data/entities-labels";

const GlobeStage = dynamic(() => import("./GlobeStage").then((m) => m.GlobeStage), { ssr: false });
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const nf = new Intl.NumberFormat("es");
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es")} %`;

const CHAPTERS = [
  ["ahora", "Ahora"],
  ["problema", "El problema"],
  ["planeta", "El planeta"],
  ["plataforma", "La plataforma"],
  ["visibles", "Menos conocidos"],
  ["datos", "Los datos"],
] as const;

const SOURCE_KINDS = ["Webs oficiales", "Redes sociales", "Notas de prensa", "Transmisiones", "Foros", "Bases de datos", "Portales especializados", "Boletines"];
const seeded = (i: number) => { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); };

export function Landing({ data }: { data: LandingData }) {
  const root = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const [chapter, setChapter] = useState<string>("ahora");
  const [stop, setStop] = useState(0);
  const fragments = [...SOURCE_KINDS, ...data.fragments].slice(0, 26);
  const c = data.conc;

  useIso(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduce ? null : new Lenis({ lerp: 0.09 });
    const raf = (t: number) => lenis?.raf(t * 1000);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const ctx = gsap.context(() => {
      gsap.from("[data-hero] > *", { y: 28, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" });

      // Capítulo activo + barra de progreso
      CHAPTERS.forEach(([id]) =>
        ScrollTrigger.create({ trigger: `#${id}`, start: "top 50%", end: "bottom 50%", onToggle: (s) => { if (s.isActive) setChapter(id); } }),
      );
      gsap.to("[data-progress]", { scaleY: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.3 } });

      // 02 · dispersión → convergencia
      const frags = gsap.utils.toArray<HTMLElement>("[data-frag]");
      const scatterTl = gsap.timeline({ scrollTrigger: { trigger: "[data-scatter]", start: "top top", end: "+=170%", scrub: 0.8, pin: true } });
      scatterTl
        .from("[data-scatter-title]", { opacity: 0, y: 30, duration: 0.25 })
        .fromTo(frags, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, stagger: 0.012, duration: 0.3 }, "<")
        .to(frags, { left: "50%", top: "55%", xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0, stagger: 0.006, duration: 0.55, ease: "power2.in" }, "+=0.25")
        .to("[data-scatter-title]", { opacity: 0, y: -30, duration: 0.2 }, "-=0.3")
        .fromTo("[data-hub]", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)" }, "-=0.2");
      ScrollTrigger.create({
        trigger: "#problema", start: "top 60%", end: "bottom top",
        onEnter: () => globe.current?.setShift(0), onLeaveBack: () => globe.current?.setShift(0.55),
      });

      // 03 · recorrido fijado: el progreso elige una parada discreta (nunca queda una tarjeta a medias)
      const nStops = data.stops.length;
      let lastIdx = -1;
      const tour = ScrollTrigger.create({
        trigger: "[data-tour-pin]", start: "top top", end: () => `+=${Math.max(1, nStops - 1) * window.innerHeight}`, pin: true,
        onUpdate: (st) => {
          const idx = Math.min(nStops - 1, Math.round(st.progress * (nStops - 1)));
          if (idx !== lastIdx) {
            lastIdx = idx;
            setStop(idx);
            const s = data.stops[idx];
            if (s) globe.current?.setTarget({ lat: s.lat, lng: s.lng, dist: 2.6, shiftX: -0.5, dim: 0 });
          }
        },
        onLeave: () => { lastIdx = -1; globe.current?.setTarget(null); },
        onLeaveBack: () => { lastIdx = -1; globe.current?.setTarget(null); },
      });
      // 05 · galería horizontal (solo escritorio)
      const track = document.querySelector<HTMLElement>("[data-htrack]");
      let gallery: ScrollTrigger | undefined;
      if (track && window.matchMedia("(min-width: 768px)").matches && !reduce) {
        gallery = gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth + 96), ease: "none",
          scrollTrigger: { trigger: "[data-hsection]", start: "top top", end: () => `+=${track.scrollWidth}`, scrub: 0.6, pin: true, invalidateOnRefresh: true },
        }).scrollTrigger;
      }

      // Encaje global: al soltar el scroll, la página se acomoda en el punto clave más cercano
      // (inicio de capítulo, final de cada animación fijada o parada del recorrido). Nunca queda a medias.
      const heads = CHAPTERS.map(([id]) => ScrollTrigger.create({ trigger: `#${id}`, start: "top top" }));
      const anchors = () => {
        const a = heads.map((h) => h.start);
        const st = scatterTl.scrollTrigger;
        if (st) a.push(st.end);
        if (gallery) a.push(gallery.end);
        if (nStops > 1) for (let i = 0; i < nStops; i++) a.push(tour.start + (i * (tour.end - tour.start)) / (nStops - 1));
        const last = document.querySelector<HTMLElement>("[data-final]");
        if (last) a.push(ScrollTrigger.maxScroll(window));
        return a;
      };
      if (lenis) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let snapping = false;
        lenis.on("scroll", () => {
          if (snapping) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            const y = lenis.scroll, vh = window.innerHeight;
            // Dentro de un tramo largo de contenido (p. ej. la galería o la cuadrícula) no se fuerza nada
            const inGallery = gallery && y > gallery.start + vh * 0.4 && y < gallery.end - vh * 0.4;
            if (inGallery) return;
            const inTour = tour.isActive;
            let best = y, bestD = Infinity;
            for (const p of anchors()) { const d = Math.abs(p - y); if (d < bestD) { bestD = d; best = p; } }
            if (bestD > 3 && (inTour || bestD < vh * 0.6)) {
              snapping = true;
              lenis.scrollTo(best, { duration: 0.75, onComplete: () => { snapping = false; } });
              setTimeout(() => { snapping = false; }, 1000);
            }
          }, 180);
        });
      }

      // Cifras que ruedan + apariciones
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const to = Number(el.dataset.count);
        const o = { v: 0 };
        gsap.to(o, {
          v: to, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%" },
          onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("es"); },
        });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
        gsap.from(el, { opacity: 0, y: 32, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } }),
      );
      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((el) =>
        gsap.from(el.children, { opacity: 0, y: 28, duration: 0.7, stagger: 0.07, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 80%" } }),
      );
    }, root);

    return () => {
      ctx.revert();
      if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); }
    };
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const n = data.next;

  return (
    <div ref={root} className="relative overflow-x-clip bg-bg text-fg">
      <div className="pointer-events-none fixed inset-0 z-0"><GlobeStage ref={globe} pads={data.pads} /></div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-bg)_95%)]" />

      {/* Barra de progreso lateral */}
      <div className="fixed top-0 bottom-0 left-0 z-30 hidden w-px bg-line md:block"><div data-progress className="h-full origin-top scale-y-0 bg-accent" /></div>

      {/* Encabezado con capítulos */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-6 bg-gradient-to-b from-bg via-bg/85 to-transparent px-5 pt-4 pb-8 md:px-8">
        <Logo />
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Capítulos">
          {CHAPTERS.map(([id, label], i) => (
            <button key={id} onClick={() => go(id)}
              className={clsx("rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors", chapter === id ? "bg-surface-2 text-fg" : "text-fg-dim hover:text-fg")}>
              <span className="num mr-1.5 text-[10.5px] text-fg-dim">{String(i + 1).padStart(2, "0")}</span>{label}
            </button>
          ))}
        </nav>
        <Link href="/panel" className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-bg/60 px-3.5 text-sm backdrop-blur hover:bg-surface-2 lg:ml-0">
          Ir a la plataforma <ArrowRight className="size-4" />
        </Link>
      </header>

      {/* 01 · AHORA — cabe en una pantalla a cualquier altura */}
      <section id="ahora" className="relative z-10 flex h-dvh min-h-[560px] flex-col">
        <div data-hero className="flex max-w-2xl flex-1 flex-col justify-center px-5 pt-20 pb-6 md:px-12 lg:px-20">
          <Eyebrow n="01" text="Monitor mundial de lanzamientos" />
          <h1 className="text-[clamp(2.1rem,min(4.4vw,7.2vh),4.4rem)] leading-[1.04] font-semibold tracking-tight">Todo lo que despega en el planeta, en un solo lugar.</h1>
          <p className="mt-4 max-w-lg text-fg-muted md:text-[17px] [@media(max-height:700px)]:hidden">
            {nf.format(data.pads.length)} plataformas en {nf.format(data.kpis.countries)} países y {nf.format(data.activeOperators)} operadores activos. Agencias gigantes y empresas que casi nadie conoce, con datos públicos.
          </p>
          {n && (
            <Link href={`/lanzamientos/${n.slug}`} className="mt-6 flex max-w-lg flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface/80 p-4 backdrop-blur transition-colors hover:border-line-strong">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2"><span className="label !text-accent">Próximo lanzamiento</span><StatusBadge abbrev={n.statusAbbrev} /></div>
                <p className="truncate font-medium">{n.missionName ?? n.name}</p>
                <p className="truncate text-xs text-fg-dim"><Flag code={n.countryCode} /> {n.rocketName} · {n.providerName}</p>
              </div>
              <Countdown net={n.net} precision={n.netPrecision} size="md" />
            </Link>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/panel" className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 font-medium text-bg hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
            <button onClick={() => go("problema")} className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-5 backdrop-blur hover:bg-surface-2">Por qué existe <ArrowDown className="size-4" /></button>
          </div>
        </div>

        {/* Cinta: próximos lanzamientos reales */}
        <div className="shrink-0 overflow-hidden border-y border-line bg-bg/70 py-3 backdrop-blur [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-8 pr-8 hover:[animation-play-state:paused]">
            {[...data.upcoming, ...data.upcoming].map((l, i) => (
              <Link key={l.slug + i} href={`/lanzamientos/${l.slug}`} className="flex items-center gap-2.5 text-[13px] whitespace-nowrap text-fg-muted hover:text-fg">
                <StatusDot abbrev={l.status} />
                <Flag code={l.country} />
                <span className="text-fg">{l.name}</span>
                <span className="text-fg-dim">{l.rocket} · {l.provider}</span>
                {isPrecise(l.precision) ? <Countdown net={l.net} precision={l.precision} size="sm" /> : <span className="num text-xs text-fg-dim">NET</span>}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 02 · EL PROBLEMA */}
      <section id="problema" className="relative z-10">
        <div data-scatter className="relative h-dvh overflow-hidden">
          <div data-scatter-title className="absolute inset-x-0 top-[15%] px-5 text-center">
            <Eyebrow n="02" text="El problema" center />
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">La información aeroespacial está dispersa.</h2>
            <p className="mx-auto mt-3 max-w-xl text-fg-muted">Decenas de agencias, empresas, webs y redes, cada una con su parte de la historia.</p>
          </div>
          {fragments.map((f, i) => (
            <span key={f + i} data-frag
              className="absolute rounded-md border border-line bg-surface/85 px-3 py-1.5 font-mono text-xs whitespace-nowrap text-fg-muted backdrop-blur"
              style={{ left: `${5 + seeded(i) * 82}%`, top: `${48 + seeded(i + 50) * 44}%` }}>
              {f}
            </span>
          ))}
          <div data-hub className="absolute top-1/2 left-1/2 w-[min(88vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-accent/40 bg-surface/95 p-5 shadow-[0_0_80px_-20px_rgba(255,91,31,.5)] backdrop-blur">
            <div className="mb-3 flex items-center gap-2"><Logo compact /><span className="label !text-accent">Un único lugar</span></div>
            <p className="text-lg font-medium">Próximos lanzamientos, mapa, organizaciones, histórico, clima, transmisiones y órbitas.</p>
            <p className="mt-2 text-sm text-fg-muted">Sincronizado automáticamente desde fuentes públicas.</p>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-px px-5 pb-24 md:grid-cols-3 md:px-12" data-stagger>
          <Pillar k="Dispersa" v={nf.format(data.activeOperators)} unit="operadores activos" text="publican su actividad cada uno en su propio canal, con formatos y horarios distintos." />
          <Pillar k="Concentrada" v={c ? pct(c.top3) : "—"} unit="en solo 3 operadores" text={`de los lanzamientos de los últimos 12 meses${data.topOperator && c ? `; ${data.topOperator} lidera con ${pct(c.top1)}` : ""}.`} />
          <Pillar k="Invisible" v={nf.format(data.lesserCount)} unit="organizaciones activas" text="suman menos de 25 lanzamientos en toda su historia y casi no aparecen en los medios." />
        </div>
      </section>

      {/* 03 · EL PLANETA */}
      <section id="planeta" className="relative z-10">
        <div className="px-5 pt-10 md:px-12 lg:px-20" data-reveal>
          <Eyebrow n="03" text="El planeta" />
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">Un recorrido por las bases que lanzan hoy.</h2>
        </div>
        <div data-tour-pin className="relative h-dvh">
          <ol className="absolute top-1/2 left-5 z-20 hidden -translate-y-1/2 flex-col gap-2.5 md:left-12 md:flex lg:left-20" aria-label="Paradas">
            {data.stops.map((s, i) => (
              <li key={s.id} className={clsx("flex items-center gap-3 text-sm transition-all duration-300", stop === i ? "text-fg" : "text-fg-dim")}>
                <span className={clsx("h-px transition-all duration-300", stop === i ? "w-8 bg-accent" : "w-4 bg-line-strong")} />
                <span className="num text-[11px]">{String(i + 1).padStart(2, "0")}</span>{s.region}
              </li>
            ))}
          </ol>
          <div className="absolute inset-x-5 bottom-8 flex justify-center gap-1.5 md:hidden">
            {data.stops.map((s, i) => <span key={s.id} className={clsx("h-1 rounded-full transition-all", stop === i ? "w-6 bg-accent" : "w-2 bg-line-strong")} />)}
          </div>
          {data.stops.map((s, i) => (
            <div key={s.id} aria-hidden={stop !== i}
              className={clsx(
                "absolute inset-x-5 bottom-14 transition-all duration-500 ease-out md:inset-x-auto md:top-1/2 md:right-12 md:bottom-auto md:w-[380px] md:-translate-y-1/2 lg:right-20",
                stop === i ? "pointer-events-auto opacity-100 md:translate-x-0" : "pointer-events-none translate-y-4 opacity-0 md:translate-x-6",
              )}>
              <div className="rounded-lg border border-line bg-surface/85 p-5 backdrop-blur">
                <p className="label mb-1"><span className="num mr-2 text-accent">{String(i + 1).padStart(2, "0")}/{String(data.stops.length).padStart(2, "0")}</span>{s.region}</p>
                <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{s.name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
                  <div className="bg-surface p-3"><p className="label">Lanzamientos</p><p className="num mt-1 text-2xl">{nf.format(s.total)}</p></div>
                  <div className="bg-surface p-3"><p className="label">Programados</p><p className="num mt-1 text-2xl text-accent">{s.upcoming}</p></div>
                </div>
                {s.operators.length > 0 && <p className="mt-3 text-xs text-fg-dim">Operan aquí: {s.operators.join(" · ")}</p>}
                <Link href={`/bases/${s.id}`} tabIndex={stop === i ? 0 : -1} className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">Ver la base <ArrowRight className="size-4" /></Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 04 · LA PLATAFORMA */}
      <section id="plataforma" className="relative z-10 bg-bg/80 px-5 py-28 backdrop-blur-sm md:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <div data-reveal>
            <Eyebrow n="04" text="La plataforma" />
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Consultar, explorar e investigar, sin saltar de sitio en sitio.</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-6" data-stagger>
            <Feature href="/panel" icon={Rocket} title="Panel en vivo" text="Próximo lanzamiento con cuenta regresiva, métricas globales y resultados recientes." className="md:col-span-3">
              <ul className="mt-4 divide-y divide-line rounded-md border border-line bg-bg/60">
                {data.upcoming.slice(0, 3).map((l) => (
                  <li key={l.slug} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <StatusDot abbrev={l.status} /><Flag code={l.country} />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {isPrecise(l.precision) && <Countdown net={l.net} precision={l.precision} size="sm" />}
                  </li>
                ))}
              </ul>
            </Feature>
            <Feature href="/mapa" icon={Map} title="Mapa mundial" text="Todas las plataformas del planeta, agrupadas, filtrables y con vista de globo." className="md:col-span-3">
              <MiniDots pads={data.pads} />
            </Feature>
            <Feature href="/lanzamientos" icon={Search} title="Explorador y búsqueda" text="Filtros combinables por operador, país, cohete, base, estado y fecha. Búsqueda global con Ctrl+K." className="md:col-span-2" />
            <Feature href="/estadisticas" icon={BarChart3} title="Estadísticas" text="Series históricas, países, vehículos y un índice de concentración." className="md:col-span-2">
              {c && (
                <div className="mt-4">
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="bg-accent" style={{ width: `${c.top1 * 100}%` }} />
                    <div className="ml-0.5 bg-[#9c988e]" style={{ width: `${(c.top3 - c.top1) * 100}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-fg-dim"><span className="text-accent">■</span> n.º 1 · <span className="text-[#9c988e]">■</span> n.º 2–3 · resto</p>
                </div>
              )}
            </Feature>
            <Feature href="/satelites" icon={Orbit} title="Satélites" text="Starlink, GPS, Galileo, meteorológicos, estaciones… en 3D, con traza y «¿cuándo pasa sobre mí?»." className="md:col-span-2" />
            <Feature href="/lanzamientos" icon={Radio} title="Transmisiones" text="Webcasts oficiales diferenciados de las retransmisiones independientes." className="md:col-span-2" />
            <Feature href="/bases" icon={CloudSun} title="Clima en la plataforma" text="Condiciones actuales y pronóstico a la hora prevista, como contexto." className="md:col-span-2" />
            <Feature href="/organizaciones" icon={Building2} title="Organizaciones" text="Agencias y empresas de todo el mundo, sin privilegiar a las famosas." className="md:col-span-2" />
          </div>

          <div className="mt-16 grid gap-3 md:grid-cols-3" data-stagger>
            <Audience icon={GraduationCap} who="Estudiantes" text="Encuentra rápido cuándo, dónde y quién lanza, con un glosario de estados." />
            <Audience icon={Microscope} who="Investigadores" text="Histórico, filtros compartibles por URL, estadísticas y fuentes citadas." />
            <Audience icon={Telescope} who="Aficionados" text="Cuenta regresiva, transmisiones, calendario (.ics) y el mapa del planeta." />
          </div>
        </div>
      </section>

      {/* 05 · MENOS CONOCIDOS (galería horizontal) */}
      <section id="visibles" className="relative z-10 bg-bg">
        <div data-hsection className="flex min-h-dvh flex-col justify-center overflow-hidden py-20">
          <div className="px-5 md:px-12 lg:px-20" data-reveal>
            <Eyebrow n="05" text="Menos conocidos" />
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">También lanzan. Casi nadie lo cuenta.</h2>
          </div>
          <div data-htrack className="mt-10 flex gap-3 overflow-x-auto px-5 pb-4 md:overflow-visible md:px-12 lg:px-20">
            {data.lesser.map((o) => (
              <Link key={o.id} href={`/organizaciones/${o.id}`}
                className="group flex min-h-[270px] w-[260px] shrink-0 flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-accent/50 md:w-[300px]">
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
            <Link href="/organizaciones?orden=menos" className="flex min-h-[270px] w-[260px] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong p-5 text-center text-sm text-fg-muted hover:text-fg md:w-[300px]">
              Ver las {nf.format(data.lesserCount)} organizaciones <ArrowRight className="mt-2 size-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 06 · LOS DATOS */}
      <section id="datos" className="relative z-10 flex min-h-dvh flex-col justify-center px-5 py-24 md:px-12 lg:px-20">
        <div data-reveal className="max-w-3xl">
          <Eyebrow n="06" text="Los datos" />
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Datos reales, fuentes abiertas, nada inventado.</h2>
          <p className="mt-4 max-w-2xl text-fg-muted">Si una fuente no ofrece un dato, la plataforma no lo muestra. Sin telemetría simulada, sin predicciones de cancelación.</p>
        </div>
        <div data-reveal className="mt-10 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
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
        <div data-stagger className="mt-8 flex max-w-5xl flex-wrap gap-2">
          {["Launch Library 2", "OpenStreetMap", "Open-Meteo", "CelesTrak", "Spaceflight News API", "Natural Earth", "Gemini (traducción)"].map((s) => (
            <span key={s} className="rounded-md border border-line bg-surface/80 px-3 py-1.5 font-mono text-xs text-fg-muted backdrop-blur">{s}</span>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section data-final className="relative z-10 flex min-h-[70dvh] flex-col items-center justify-center px-5 text-center">
        <div data-reveal>
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Deja de buscar en diez sitios distintos.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/panel" className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 font-medium text-black hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
            <Link href="/metodologia" className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-6 backdrop-blur hover:bg-surface-2">Cómo funciona</Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line bg-bg px-5 py-10 md:px-12 lg:px-20">
        <div className="mx-auto grid max-w-6xl gap-8 text-sm md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-fg-dim">
              Proyecto académico: centralización de información aeroespacial dispersa mediante APIs públicas y herramientas WebGIS.
              La información oficial pertenece a cada organización.
            </p>
          </div>
          <FooterCol title="Plataforma" links={[["Panel", "/panel"], ["Mapa", "/mapa"], ["Lanzamientos", "/lanzamientos"], ["Estadísticas", "/estadisticas"]]} />
          <FooterCol title="Información" links={[["Metodología", "/metodologia"], ["Organizaciones", "/organizaciones"], ["Bases", "/bases"], ["Noticias", "/noticias"]]} />
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-[11px] text-fg-dim">
          Datos: The Space Devs (Launch Library 2, Spaceflight News API) · Cartografía © OpenStreetMap contributors · Clima: Open-Meteo · Órbitas: CelesTrak · Continentes: Natural Earth.
        </p>
      </footer>
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
    <div className="border-t border-line-strong bg-bg/70 p-6 backdrop-blur md:border-t-0 md:border-l md:first:border-l-0">
      <p className="label mb-3">{k}</p>
      <p className="num text-4xl">{v}</p>
      <p className="mt-1 text-sm text-fg">{unit}</p>
      <p className="mt-2 text-sm text-fg-muted">{text}</p>
    </div>
  );
}

function Feature({ href, icon: Icon, title, text, className, children }: { href: string; icon: typeof Map; title: string; text: string; className?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("group flex flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong", className)}>
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md border border-line bg-surface-2 text-accent"><Icon className="size-4" strokeWidth={1.75} /></span>
        <ArrowRight className="size-4 -translate-x-1 text-fg-dim opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-fg-muted">{text}</p>
      {children}
    </Link>
  );
}

function Audience({ icon: Icon, who, text }: { icon: typeof Map; who: string; text: string }) {
  return (
    <div className="flex gap-4 rounded-lg border border-line bg-surface/60 p-5">
      <Icon className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={1.5} />
      <div><p className="font-medium">{who}</p><p className="mt-1 text-sm text-fg-muted">{text}</p></div>
    </div>
  );
}

function MiniDots({ pads }: { pads: LandingData["pads"] }) {
  const W = 360, H = 150;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full rounded-md border border-line bg-bg/60" aria-hidden>
      {pads.map((p, i) => (
        <circle key={i} cx={((p.lng + 180) / 360) * W} cy={((78 - p.lat) / 140) * H} r={p.upcoming ? 2.6 : 1.5}
          fill={p.upcoming ? "var(--color-accent)" : "var(--color-fg-dim)"} opacity={p.upcoming ? 0.95 : 0.5} />
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
