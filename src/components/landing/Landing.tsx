"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ArrowRight, ArrowDown } from "lucide-react";
import type { LandingData } from "@/lib/data/landing";
import type { GlobeHandle } from "./GlobeStage";
import { Logo } from "@/components/shell/Logo";
import { Countdown } from "@/components/launch/Countdown";
import { StatusBadge } from "@/components/launch/StatusBadge";

const GlobeStage = dynamic(() => import("./GlobeStage").then((m) => m.GlobeStage), { ssr: false });

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const nf = new Intl.NumberFormat("es");

// Fuentes "dispersas": tipos genéricos + organizaciones reales de los datos
const SOURCE_KINDS = ["Webs oficiales", "Redes sociales", "Notas de prensa", "Transmisiones", "Foros", "Bases de datos", "Avisos NOTAM", "Portales especializados"];

// Posiciones pseudoaleatorias deterministas (mismo resultado en servidor y cliente)
const seeded = (i: number) => { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); };

export function Landing({ data }: { data: LandingData }) {
  const root = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const fragments = [...SOURCE_KINDS, ...data.fragments].slice(0, 26);

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
      // Hero: entrada
      gsap.from("[data-hero] > *", { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" });

      // Dispersión → convergencia
      const frags = gsap.utils.toArray<HTMLElement>("[data-frag]");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: "[data-scatter]", start: "top top", end: "+=160%", scrub: 0.8, pin: true },
      });
      tl.from("[data-scatter-title]", { opacity: 0, y: 30, duration: 0.3 })
        .fromTo(frags, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, stagger: 0.015, duration: 0.3 }, "<")
        .to(frags, { x: 0, y: 0, left: "50%", top: "50%", xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0, stagger: 0.008, duration: 0.6, ease: "power2.in" }, "+=0.2")
        .fromTo("[data-hub]", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, "-=0.25")
        .to("[data-scatter-title]", { opacity: 0.25, duration: 0.2 }, "<");

      ScrollTrigger.create({
        trigger: "[data-scatter]", start: "top 60%", end: "bottom top",
        onEnter: () => globe.current?.setShift(0), onLeaveBack: () => globe.current?.setShift(0.55),
      });

      // Recorrido: cada parada orienta el globo a su base real
      gsap.utils.toArray<HTMLElement>("[data-stop]").forEach((el) => {
        const lat = Number(el.dataset.lat), lng = Number(el.dataset.lng);
        ScrollTrigger.create({
          trigger: el, start: "top 55%", end: "bottom 45%",
          onToggle: (s) => { if (s.isActive) globe.current?.setTarget({ lat, lng, dist: 2.6, shiftX: -0.5, dim: 0 }); },
        });
        gsap.from(el.querySelector("[data-card]"), { opacity: 0, y: 40, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 70%" } });
      });
      ScrollTrigger.create({ trigger: "[data-tour]", start: "top 60%", end: "bottom 40%", onLeave: () => globe.current?.setTarget(null), onLeaveBack: () => globe.current?.setTarget(null) });

      // Cifras que ruedan
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const to = Number(el.dataset.count), dec = Number(el.dataset.dec ?? 0), suffix = el.dataset.suffix ?? "";
        const o = { v: 0 };
        gsap.to(o, {
          v: to, duration: 1.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => { el.textContent = o.v.toLocaleString("es", { maximumFractionDigits: dec, minimumFractionDigits: dec }) + suffix; },
        });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
        gsap.from(el, { opacity: 0, y: 30, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 80%" } }),
      );
    }, root);

    return () => {
      ctx.revert();
      if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); }
    };
  }, []);

  const n = data.next;
  const c = data.conc;

  return (
    <div ref={root} className="relative bg-bg text-fg">
      {/* Globo fijo detrás del contenido */}
      <div className="pointer-events-none fixed inset-0 z-0"><GlobeStage ref={globe} pads={data.pads} /></div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--color-bg)_95%)]" />

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-bg via-bg/85 to-transparent px-5 pt-4 pb-8 md:px-8">
        <Logo />
        <Link href="/panel" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-bg/60 px-3.5 text-sm backdrop-blur hover:bg-surface-2">
          Ir a la plataforma <ArrowRight className="size-4" />
        </Link>
      </header>

      {/* 1 · Hero */}
      <section className="relative z-10 flex min-h-dvh items-center px-5 pt-20 md:px-12 lg:px-20">
        <div data-hero className="max-w-xl">
          <p className="label mb-4 !text-accent">Monitor mundial de lanzamientos</p>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">Todo lo que despega en el planeta, en un solo lugar.</h1>
          <p className="mt-5 max-w-md text-fg-muted md:text-lg">
            {nf.format(data.pads.length)} plataformas en {nf.format(data.kpis.countries)} países. Agencias gigantes y empresas que casi nadie conoce, con datos públicos y verificables.
          </p>
          {n && (
            <Link href={`/lanzamientos/${n.slug}`} className="mt-8 block max-w-md rounded-lg border border-line bg-surface/80 p-4 backdrop-blur transition-colors hover:border-line-strong">
              <div className="mb-3 flex items-center gap-2"><span className="label !text-accent">Próximo</span><StatusBadge abbrev={n.statusAbbrev} /></div>
              <p className="truncate font-medium">{n.missionName ?? n.name}</p>
              <p className="mb-3 truncate text-xs text-fg-dim">{n.rocketName} · {n.providerName} · {n.locationName}</p>
              <Countdown net={n.net} precision={n.netPrecision} />
            </Link>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/panel" className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 font-medium text-bg hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
            <Link href="/mapa" className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-5 backdrop-blur hover:bg-surface-2">Explorar el mapa</Link>
          </div>
        </div>
        <p className="label absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2"><ArrowDown className="size-3.5 animate-bounce" /> Desliza</p>
      </section>

      {/* 2 · La información está dispersa */}
      <section data-scatter className="relative z-10 h-dvh overflow-hidden">
        <div data-scatter-title className="absolute inset-x-0 top-[14%] px-5 text-center">
          <p className="label mb-3">El problema</p>
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">La información aeroespacial está dispersa.</h2>
          <p className="mx-auto mt-3 max-w-xl text-fg-muted">Decenas de agencias, empresas, webs y redes. Cada una con su parte de la historia.</p>
        </div>
        {fragments.map((f, i) => (
          <span key={f + i} data-frag
            className="absolute rounded-md border border-line bg-surface/85 px-3 py-1.5 font-mono text-xs whitespace-nowrap text-fg-muted backdrop-blur"
            style={{ left: `${6 + seeded(i) * 82}%`, top: `${48 + seeded(i + 50) * 44}%` }}>
            {f}
          </span>
        ))}
        <div data-hub className="absolute top-1/2 left-1/2 w-[min(88vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-accent/40 bg-surface/95 p-5 shadow-[0_0_80px_-20px_rgba(255,91,31,.5)] backdrop-blur">
          <div className="mb-3 flex items-center gap-2"><Logo compact /><span className="label !text-accent">Un único lugar</span></div>
          <p className="text-lg font-medium">Próximos lanzamientos, mapa, organizaciones, histórico, clima y órbitas.</p>
          <p className="mt-2 text-sm text-fg-muted">Sincronizado cada 15 minutos desde fuentes públicas.</p>
        </div>
      </section>

      {/* 3 · Recorrido por el planeta */}
      <section data-tour className="relative z-10">
        {data.stops.map((s) => (
          <div key={s.id} data-stop data-lat={s.lat} data-lng={s.lng} className="flex min-h-dvh items-end px-5 pb-10 md:items-center md:justify-end md:px-12 md:pb-0 lg:px-20">
            <div data-card className="w-full max-w-sm rounded-lg border border-line bg-surface/85 p-5 backdrop-blur">
              <p className="label mb-1">{s.region}</p>
              <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{s.name}</h3>
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
                <div className="bg-surface p-3"><p className="label">Lanzamientos</p><p className="num mt-1 text-2xl">{nf.format(s.total)}</p></div>
                <div className="bg-surface p-3"><p className="label">Programados</p><p className="num mt-1 text-2xl text-accent">{s.upcoming}</p></div>
              </div>
              {s.operators.length > 0 && <p className="mt-3 text-xs text-fg-dim">Operan aquí: {s.operators.join(" · ")}</p>}
              <Link href={`/bases/${s.id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">Ver la base <ArrowRight className="size-4" /></Link>
            </div>
          </div>
        ))}
      </section>

      {/* 4 · Cifras reales */}
      <section className="relative z-10 flex min-h-dvh flex-col justify-center px-5 md:px-12 lg:px-20">
        <div data-reveal className="max-w-3xl">
          <p className="label mb-3">Los datos</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Pocos actores concentran casi toda la actividad.</h2>
          {c && data.topOperator && (
            <p className="mt-4 max-w-2xl text-fg-muted">
              En los últimos 12 meses, {data.topOperator} realizó el <span className="text-fg">{Math.round(c.top1 * 1000) / 10} %</span> de los lanzamientos y los tres primeros operadores sumaron el{" "}
              <span className="text-fg">{Math.round(c.top3 * 1000) / 10} %</span>. Por eso esta plataforma también da visibilidad a los demás.
            </p>
          )}
        </div>
        <div data-reveal className="mt-10 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
          {[
            ["Programados", data.kpis.upcoming, 0, ""],
            ["Operadores activos", data.kpis.operators, 0, ""],
            ["Países con bases activas", data.kpis.countries, 0, ""],
            ["Índice HHI (12 m)", c?.hhi ?? 0, 0, ""],
          ].map(([k, v, d, s]) => (
            <div key={k as string} className="bg-surface/90 p-5 backdrop-blur">
              <p className="label">{k}</p>
              <p className="num mt-2 text-4xl" data-count={v as number} data-dec={d as number} data-suffix={s as string}>0</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-fg-dim">Datos: Launch Library 2 (The Space Devs). Calculados en tiempo de consulta.</p>
      </section>

      {/* 5 · CTA */}
      <section className="relative z-10 flex min-h-[80dvh] flex-col items-center justify-center px-5 text-center">
        <div data-reveal>
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Deja de buscar en diez sitios distintos.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/panel" className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 font-medium text-black hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
            <Link href="/metodologia" className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-6 backdrop-blur hover:bg-surface-2">Cómo funciona</Link>
          </div>
          <p className="mt-10 text-[11px] text-fg-dim">
            Proyecto académico · Datos: The Space Devs · Cartografía © OpenStreetMap · Continentes: Natural Earth
          </p>
        </div>
      </section>
    </div>
  );
}

