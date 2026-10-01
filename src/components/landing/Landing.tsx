"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import gsap from "gsap";
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
 * Portada cinematográfica en escenas a pantalla completa (sin scroll de documento):
 *  · un gesto (rueda, deslizamiento o tecla) = una escena; la inercia del trackpad se ignora;
 *  · los saltos del menú (1 → 4) van DIRECTOS con la misma transición: nunca se recorren las intermedias;
 *  · transición: la escena saliente se aleja con desenfoque; la entrante llega nítida y sus elementos entran en cascada;
 *  · el globo 3D acompaña cada escena con un único movimiento suave (posición, enfoque y atenuación);
 *  · las animaciones propias (convergencia, cifras) solo se reproducen con la escena quieta; si te vas, quedan terminadas;
 *  · si el contenido no cabe (móvil), se desplaza por dentro y el gesto en el borde cambia de escena.
 */
const SLIDES = [
  { id: "ahora", label: "Ahora" },
  { id: "problema", label: "El problema" },
  { id: "planeta", label: "El planeta" },
  { id: "plataforma", label: "La plataforma" },
  { id: "visibles", label: "Menos conocidos" },
  { id: "datos", label: "Los datos" },
  { id: "empezar", label: "Empezar" },
] as const;
type SlideId = (typeof SLIDES)[number]["id"];

// Puesta en escena del globo: posición horizontal y atenuación para que el texto mande
const GLOBE: Record<SlideId, { shift: number; dim: number }> = {
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
const IN = "[data-in], [data-in-stagger] > *";

export function Landing({ data }: { data: LandingData }) {
  const root = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeHandle>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const dimRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const played = useRef<Set<SlideId>>(new Set());
  const scatter = useRef<gsap.core.Timeline | null>(null);
  const counters = useRef<gsap.core.Tween[]>([]);
  const reduce = useRef(false);
  const [stop, setStop] = useState(0);
  const stopRef = useRef(0);
  const [tourAuto, setTourAuto] = useState(true);
  const track = useRef<HTMLDivElement>(null);
  const live = useLive();
  const n = live?.next ?? data.next; // tarjeta del próximo lanzamiento: en vivo, sin recargar
  const c = data.conc;
  const fragments = [...SOURCE_KINDS, ...data.fragments].slice(0, 24);

  const applyGlobe = useCallback((id: SlideId, stopIdx: number) => {
    const g = GLOBE[id];
    const st = data.stops[stopIdx];
    const target: GlobeTarget = id === "planeta" && st ? { lat: st.lat, lng: st.lng, dist: 2.6, shiftX: -0.5, dim: 0 } : null;
    globe.current?.setTarget(target);
    globe.current?.setShift(g.shift);
    if (dimRef.current) gsap.to(dimRef.current, { opacity: g.dim, duration: reduce.current ? 0 : 0.8, ease: "power2.out" });
  }, [data.stops]);

  // Animaciones propias: solo con la escena quieta
  const onSettle = useCallback((id: SlideId) => {
    if (id === "problema" && scatter.current && !played.current.has(id)) scatter.current.play();
    if (id === "datos" && !played.current.has(id)) counters.current.forEach((t) => t.play());
    played.current.add(id);
  }, []);
  const finishPending = useCallback((leaving: SlideId) => {
    if (leaving === "problema" && scatter.current && scatter.current.progress() < 1) scatter.current.progress(1);
    if (leaving === "datos") counters.current.forEach((t) => t.progress(1));
  }, []);

  /** Entrada en cascada de los elementos de una escena (rápida: < 0,6 s en total). */
  const cascade = useCallback((el: HTMLElement | null, dir: number, delay = 0) => {
    if (!el || reduce.current) return gsap.timeline();
    const items = el.querySelectorAll(IN);
    return gsap.timeline({ delay }).fromTo(items,
      { opacity: 0, y: 40 * dir },
      { opacity: 1, y: 0, duration: 0.75, stagger: 0.05, ease: "power3.out", clearProps: "transform" });
  }, []);

  const goTo = useCallback((to: number) => {
    const from = indexRef.current;
    if (to < 0 || to >= SLIDES.length || to === from || busy.current) return;
    busy.current = true;
    const dir = to > from ? 1 : -1;
    const a = slides.current[from], b = slides.current[to];
    finishPending(SLIDES[from].id);
    if (SLIDES[to].id === "planeta" && data.stops.length) {
      const k = dir > 0 ? 0 : data.stops.length - 1;
      stopRef.current = k;
      setStop(k);
      setTourAuto(true);
    }
    indexRef.current = to;
    setIndex(to);
    applyGlobe(SLIDES[to].id, stopRef.current);
    try { history.replaceState(null, "", `#${SLIDES[to].id}`); } catch { /* sin historial */ }
    if (b) b.scrollTop = dir > 0 ? 0 : b.scrollHeight;
    // Entrar a "Menos conocidos" desde abajo deja la galería al final (se recorre hacia atrás)
    if (SLIDES[to].id === "visibles" && track.current) track.current.scrollLeft = dir > 0 ? 0 : track.current.scrollWidth;
    const d = reduce.current ? 0 : 1;
    // Protección: si la pestaña queda oculta a mitad de la transición (el navegador congela las animaciones), se completa sola
    const guard = setTimeout(() => tl.progress(1), 1600);
    const tl = gsap.timeline({ onComplete: () => { clearTimeout(guard); busy.current = false; onSettle(SLIDES[to].id); } });
    tl.set(b, { autoAlpha: 1, yPercent: 100 * dir })
      .to(a, { yPercent: -100 * dir, duration: 0.95 * d, ease: "power3.inOut" }, 0)
      .to(b, { yPercent: 0, duration: 0.95 * d, ease: "power3.inOut" }, 0)
      .set(a, { autoAlpha: 0, yPercent: 0 });
    if (d) tl.add(cascade(b, dir), 0.3);
  }, [applyGlobe, cascade, finishPending, onSettle, data.stops.length]);

  const selectStop = useCallback((i: number, manual = true) => {
    const k = (i + data.stops.length) % Math.max(1, data.stops.length);
    stopRef.current = k;
    setStop(k);
    if (manual) setTourAuto(false);
    if (SLIDES[indexRef.current].id === "planeta") applyGlobe("planeta", k);
  }, [applyGlobe, data.stops.length]);

  // Recorrido: avance automático mientras la escena está activa y el usuario no ha elegido una base
  useEffect(() => {
    if (SLIDES[index].id !== "planeta" || !tourAuto || data.stops.length < 2) return;
    const iv = setInterval(() => selectStop(stopRef.current + 1, false), 6500);
    return () => clearInterval(iv);
  }, [index, tourAuto, data.stops.length, selectStop]);

  useIso(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slides.current = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? []);
    const hash = location.hash.slice(1);
    const start = Math.max(0, SLIDES.findIndex((sl) => sl.id === hash));
    indexRef.current = start;
    setIndex(start);
    slides.current.forEach((el, i) => el && gsap.set(el, { autoAlpha: i === start ? 1 : 0 }));
    applyGlobe(SLIDES[start].id, 0);

    const ctx = gsap.context(() => {
      cascade(slides.current[start], 1, 0.1);
      // Convergencia de fuentes (en pausa hasta que "El problema" esté quieta)
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
    const settleTimer = setTimeout(() => onSettle(SLIDES[start].id), 700);

    // ── Entrada: un gesto = un paso (base del recorrido, tramo de galería o escena) ──
    let lastWheel = 0, acc = 0, lockUntil = 0, hEdgeAt = 0;
    const advance = (dir: 1 | -1) => {
      const id = SLIDES[indexRef.current].id;
      if (id === "planeta") {
        const k = stopRef.current + dir;
        if (k >= 0 && k < data.stops.length) { selectStop(k); return; }
      }
      if (id === "visibles" && track.current) {
        const t = track.current, max = t.scrollWidth - t.clientWidth;
        if (dir > 0 ? t.scrollLeft < max - 4 : t.scrollLeft > 4) {
          t.scrollBy({ left: dir * Math.min(600, t.clientWidth * 0.75), behavior: reduce.current ? "auto" : "smooth" });
          return;
        }
      }
      goTo(indexRef.current + dir);
    };
    const scroller = () => slides.current[indexRef.current];
    const atEdge = (dir: 1 | -1) => {
      const el = scroller();
      if (!el || el.scrollHeight <= el.clientHeight + 2) return true;
      return dir > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 2;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && (e.target as HTMLElement).closest("[data-hscroll]")) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const now = performance.now(), gap = now - lastWheel;
      lastWheel = now;
      if (!atEdge(dir)) { acc = 0; return; } // el contenido de esta escena se desplaza por dentro
      e.preventDefault();
      // "Menos conocidos": el scroll vertical desplaza la galería en horizontal hasta mostrarla entera
      if (SLIDES[indexRef.current].id === "visibles" && track.current && !busy.current) {
        const t = track.current, max = t.scrollWidth - t.clientWidth;
        if (dir > 0 ? t.scrollLeft < max - 2 : t.scrollLeft > 2) { t.scrollLeft += e.deltaY * 1.2; hEdgeAt = now; return; }
        if (now - hEdgeAt < 260) { hEdgeAt = now; return; } // llegó al borde en este mismo gesto: espera uno nuevo
      }
      if (busy.current || now < lockUntil) { lockUntil = Math.max(lockUntil, now + 120); return; } // inercia del gesto anterior
      if (gap > 200) acc = 0;
      acc += e.deltaY;
      if (Math.abs(acc) > 30) {
        acc = 0;
        lockUntil = now + 500;
        advance(dir);
      }
    };
    let ty = 0, tx = 0, edge = { up: true, down: true };
    const onTouchStart = (e: TouchEvent) => { ty = e.touches[0].clientY; tx = e.touches[0].clientX; edge = { up: atEdge(-1), down: atEdge(1) }; };
    const onTouchMove = (e: TouchEvent) => {
      const dy = ty - e.touches[0].clientY, dx = tx - e.touches[0].clientX;
      if (Math.abs(dy) > Math.abs(dx) && ((dy > 0 && edge.down) || (dy < 0 && edge.up))) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = ty - e.changedTouches[0].clientY, dx = tx - e.changedTouches[0].clientX;
      if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx)) return;
      if (dy > 0 && edge.down) advance(1);
      else if (dy < 0 && edge.up) advance(-1);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const k = e.key;
      if (["ArrowDown", "PageDown", " "].includes(k) && atEdge(1)) { e.preventDefault(); if (!busy.current) advance(1); }
      else if (["ArrowUp", "PageUp"].includes(k) && atEdge(-1)) { e.preventDefault(); if (!busy.current) advance(-1); }
      else if (k === "Home") { e.preventDefault(); goTo(0); }
      else if (k === "End") { e.preventDefault(); goTo(SLIDES.length - 1); }
      else if (SLIDES[indexRef.current].id === "planeta" && (k === "ArrowRight" || k === "ArrowLeft")) selectStop(stopRef.current + (k === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      ctx.revert();
    };
  }, []);

  const slideCls = "invisible absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]";
  const scrollTrack = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * Math.min(640, track.current.clientWidth * 0.8), behavior: "smooth" });
  const s = data.stops[stop];

  return (
    <div ref={root} className="fixed inset-0 overflow-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-0"><GlobeStage ref={globe} pads={data.pads} /></div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-bg)_95%)]" />
      <div ref={dimRef} className="pointer-events-none absolute inset-0 bg-bg opacity-0" />

      {/* Encabezado con capítulos */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-6 bg-gradient-to-b from-bg via-bg/85 to-transparent px-5 pt-4 pb-8 md:px-8">
        <button onClick={() => goTo(0)} aria-label="Inicio"><Logo /></button>
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Capítulos">
          {SLIDES.slice(0, 6).map((sl, i) => (
            <button key={sl.id} onClick={() => goTo(i)} aria-current={index === i ? "step" : undefined}
              className={clsx("rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors", index === i ? "bg-surface-2 text-fg" : "text-fg-dim hover:text-fg")}>
              <span className="num mr-1.5 text-[10.5px] text-fg-dim">{String(i + 1).padStart(2, "0")}</span>{sl.label}
            </button>
          ))}
        </nav>
        <Link href="/panel" className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-bg/60 px-3.5 text-sm backdrop-blur hover:bg-surface-2 lg:ml-0">
          Ir a la plataforma <ArrowRight className="size-4" />
        </Link>
      </header>

      {/* Indicador de escenas + progreso */}
      <nav className="absolute top-1/2 right-4 z-30 hidden -translate-y-1/2 flex-col items-end gap-2.5 md:flex" aria-label="Escenas">
        {SLIDES.map((sl, i) => (
          <button key={sl.id} onClick={() => goTo(i)} title={sl.label} aria-label={sl.label} className="group flex items-center gap-2">
            <span className={clsx("text-[11px] opacity-0 transition-opacity group-hover:opacity-100", index === i ? "text-fg" : "text-fg-dim")}>{sl.label}</span>
            <span className={clsx("block rounded-full transition-all duration-300", index === i ? "h-5 w-1.5 bg-accent" : "size-1.5 bg-fg-dim/60 group-hover:bg-fg")} />
          </button>
        ))}
      </nav>
      <div className="absolute top-0 left-0 z-30 h-0.5 bg-accent transition-[width] duration-700 ease-out" style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }} />

      <main className="absolute inset-0 z-10">
        {/* 01 · AHORA */}
        <section data-slide id="ahora" className={slideCls} aria-label="Ahora">
          <div className="flex min-h-full flex-col">
            <div className="flex max-w-2xl flex-1 flex-col justify-center px-5 pt-24 pb-6 md:px-12 lg:px-20">
              <div data-in><Eyebrow n="01" text="Monitor mundial de lanzamientos" /></div>
              <h1 data-in className="text-[clamp(2.1rem,min(4.4vw,7.2vh),4.4rem)] leading-[1.04] font-semibold tracking-tight">Todo lo que despega en el planeta, en un solo lugar.</h1>
              <p data-in className="mt-4 max-w-lg text-fg-muted md:text-[17px] [@media(max-height:700px)]:hidden">
                {nf.format(data.pads.length)} plataformas en {nf.format(data.kpis.countries)} países y {nf.format(data.activeOperators)} operadores activos. Agencias gigantes y empresas que casi nadie conoce, con datos públicos.
              </p>
              {n && (
                <Link data-in href={`/lanzamientos/${n.slug}`} className="mt-6 flex max-w-lg flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface/80 p-4 backdrop-blur transition-colors hover:border-line-strong">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2"><span className="label !text-accent">Próximo lanzamiento</span><StatusBadge key={n.statusAbbrev} abbrev={n.statusAbbrev} className="animate-status-pop" /></div>
                    <p className="truncate font-medium">{n.missionName ?? n.name}</p>
                    <p className="truncate text-xs text-fg-dim"><Flag code={n.countryCode} /> {n.rocketName} · {n.providerName}</p>
                  </div>
                  <Countdown net={n.net} precision={n.netPrecision} size="md" status={n.statusAbbrev} />
                </Link>
              )}
              <div data-in className="mt-6 flex flex-wrap gap-3">
                {n && <WatchButton watch={live?.next?.watch} net={n.net} webcastLive={n.webcastLive} className="h-11" />}
                <Link href="/panel" className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 font-medium text-bg hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
                <button onClick={() => goTo(1)} className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-5 backdrop-blur hover:bg-surface-2">Por qué existe <ArrowDown className="size-4" /></button>
              </div>
            </div>
            <div data-in className="shrink-0 overflow-hidden border-y border-line bg-bg/70 py-3 backdrop-blur [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
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
          </div>
        </section>

        {/* 02 · EL PROBLEMA */}
        <section data-slide id="problema" className={slideCls} aria-label="El problema">
          <div className="flex min-h-full flex-col px-5 pt-24 pb-6 md:px-12">
            <div className="text-center">
              <div data-in><Eyebrow n="02" text="El problema" center /></div>
              <h2 data-in className="mx-auto max-w-3xl text-[clamp(1.7rem,min(4vw,6vh),3rem)] leading-tight font-semibold tracking-tight">La información aeroespacial está dispersa.</h2>
              <p data-in className="mx-auto mt-2 max-w-xl text-sm text-fg-muted md:text-base">Decenas de agencias, empresas, webs y redes, cada una con su parte de la historia.</p>
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
          </div>
        </section>

        {/* 03 · EL PLANETA — recorrido con selector propio; el globo gira a la base elegida */}
        <section data-slide id="planeta" className={slideCls} aria-label="El planeta">
          <div className="flex min-h-full flex-col justify-between gap-6 px-5 pt-24 pb-8 md:flex-row md:items-center md:px-12 lg:px-20">
            <div className="md:max-w-sm">
              <div data-in><Eyebrow n="03" text="El planeta" /></div>
              <h2 data-in className="text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Un recorrido por las bases que lanzan hoy.</h2>
              <ol data-in-stagger className="mt-6 hidden space-y-1 md:block" aria-label="Bases">
                {data.stops.map((st, i) => (
                  <li key={st.id}>
                    <button onClick={() => selectStop(i)} className={clsx("flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors", stop === i ? "bg-surface-2/80 text-fg" : "text-fg-dim hover:text-fg")}>
                      <span className={clsx("h-px transition-all duration-300", stop === i ? "w-6 bg-accent" : "w-3 bg-line-strong")} />
                      <span className="num text-[11px]">{String(i + 1).padStart(2, "0")}</span>{st.region}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {s && (
              <div data-in className="w-full md:w-[380px]">
                <div key={s.id} className="animate-fade-in rounded-lg border border-line bg-surface/90 p-5 backdrop-blur">
                  <p className="label mb-1"><span className="num mr-2 text-accent">{String(stop + 1).padStart(2, "0")}/{String(data.stops.length).padStart(2, "0")}</span>{s.region}</p>
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
                    <button onClick={() => selectStop(stop - 1)} aria-label="Base anterior" className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-bg/60 backdrop-blur hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
                    <button onClick={() => selectStop(stop + 1)} aria-label="Base siguiente" className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-bg/60 backdrop-blur hover:bg-surface-2"><ChevronRight className="size-4" /></button>
                  </div>
                  <div className="flex gap-1.5">
                    {data.stops.map((st, i) => <button key={st.id} onClick={() => selectStop(i)} aria-label={st.region} className={clsx("h-1 rounded-full transition-all duration-300", stop === i ? "w-6 bg-accent" : "w-2 bg-line-strong")} />)}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-fg-dim">{tourAuto ? "Desliza para recorrer las bases · o elige una" : "Desliza o usa ← → para cambiar de base"}</p>
              </div>
            )}
          </div>
        </section>

        {/* 04 · LA PLATAFORMA */}
        <section data-slide id="plataforma" className={slideCls} aria-label="La plataforma">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-5 pt-24 pb-8 md:px-12">
            <div data-in><Eyebrow n="04" text="La plataforma" /></div>
            <h2 data-in className="max-w-2xl text-[clamp(1.6rem,min(3.6vw,5.5vh),2.8rem)] leading-tight font-semibold tracking-tight">Consultar, explorar e investigar, sin saltar de sitio en sitio.</h2>
            <div data-in-stagger className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        {/* 05 · MENOS CONOCIDOS */}
        <section data-slide id="visibles" className={slideCls} aria-label="Menos conocidos">
          <div className="flex min-h-full flex-col justify-center pt-24 pb-8">
            <div className="flex flex-wrap items-end justify-between gap-4 px-5 md:px-12 lg:px-20">
              <div>
                <div data-in><Eyebrow n="05" text="Menos conocidos" /></div>
                <h2 data-in className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">También lanzan. Casi nadie lo cuenta.</h2>
              </div>
              <div data-in className="hidden gap-2 md:flex">
                <button onClick={() => scrollTrack(-1)} aria-label="Anteriores" className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-bg/60 hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
                <button onClick={() => scrollTrack(1)} aria-label="Siguientes" className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-bg/60 hover:bg-surface-2"><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <div ref={track} data-hscroll data-in-stagger className="mt-8 flex scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 pb-4 [scrollbar-width:none] md:scroll-px-12 md:px-12 lg:scroll-px-20 lg:px-20 [&::-webkit-scrollbar]:hidden">
              {data.lesser.map((o) => (
                <Link key={o.id} href={`/organizaciones/${o.id}`} className="group flex min-h-[260px] w-[250px] shrink-0 snap-start flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-accent/50 md:w-[290px]">
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
              <Link href="/organizaciones?orden=menos" className="flex min-h-[260px] w-[250px] shrink-0 snap-start flex-col items-center justify-center rounded-lg border border-dashed border-line-strong p-5 text-center text-sm text-fg-muted hover:text-fg md:w-[290px]">
                Ver las {nf.format(data.lesserCount)} organizaciones <ArrowRight className="mt-2 size-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* 06 · LOS DATOS */}
        <section data-slide id="datos" className={slideCls} aria-label="Los datos">
          <div className="flex min-h-full flex-col justify-center px-5 pt-24 pb-8 md:px-12 lg:px-20">
            <div className="max-w-3xl">
              <div data-in><Eyebrow n="06" text="Los datos" /></div>
              <h2 data-in className="text-3xl leading-tight font-semibold tracking-tight md:text-5xl">Datos reales, fuentes abiertas, nada inventado.</h2>
              <p data-in className="mt-4 max-w-2xl text-fg-muted">Si una fuente no ofrece un dato, la plataforma no lo muestra. Sin telemetría simulada ni predicciones de cancelación.</p>
            </div>
            <div data-in-stagger className="mt-8 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
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
            <div data-in-stagger className="mt-6 flex max-w-5xl flex-wrap gap-2">
              {["Launch Library 2", "OpenStreetMap", "Open-Meteo", "CelesTrak", "Spaceflight News API", "Natural Earth", "Gemini (traducción)"].map((x) => (
                <span key={x} className="rounded-md border border-line bg-surface/80 px-3 py-1.5 font-mono text-xs text-fg-muted backdrop-blur">{x}</span>
              ))}
            </div>
          </div>
        </section>

        {/* 07 · EMPEZAR + pie */}
        <section data-slide id="empezar" className={slideCls} aria-label="Empezar">
          <div className="flex min-h-full flex-col">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pt-24 pb-6 text-center md:px-12">
              <h2 data-in className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">Deja de buscar en diez sitios distintos.</h2>
              <div data-in className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/panel" className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 font-medium text-black hover:opacity-90">Entrar a la plataforma <ArrowRight className="size-4" /></Link>
                <Link href="/acerca" className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-bg/50 px-6 backdrop-blur hover:bg-surface-2">Acerca del proyecto</Link>
              </div>
              <div data-in-stagger className="mt-10 grid gap-3 text-left md:grid-cols-3">
                <Audience icon={GraduationCap} who="Estudiantes" text="Cuándo, dónde y quién lanza, con glosario de estados." />
                <Audience icon={Microscope} who="Investigadores" text="Histórico, filtros compartibles, estadísticas y fuentes citadas." />
                <Audience icon={Telescope} who="Aficionados" text="Cuenta regresiva, transmisiones, calendario y satélites." />
              </div>
            </div>
            <footer data-in className="border-t border-line bg-bg/90 px-5 py-6 backdrop-blur md:px-12 lg:px-20">
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
          </div>
        </section>
      </main>

      {index === 0 && (
        <button onClick={() => goTo(1)} aria-label="Siguiente escena"
          className="absolute bottom-16 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 text-[11px] text-fg-dim hover:text-fg md:flex [@media(max-height:700px)]:hidden">
          <ArrowDown className="size-3.5 animate-bounce" /> Desliza
        </button>
      )}
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
