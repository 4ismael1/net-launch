import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Sidebar, MobileNav } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<div className="sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r border-line md:block sb-collapsed:w-[60px]" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pt-5 pb-8 md:px-6 md:pb-10">
          <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">{children}</ViewTransition>
        </main>
        <footer data-app-footer className="border-t border-line px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-[11px] leading-relaxed text-fg-dim md:px-6 md:pb-4">
          Proyecto de investigación de <Link href="/acerca" className="text-fg-muted transition-colors hover:text-fg">Ana Isabel Ruiz Gómez y Yeslei Vannesa Mora Gómez</Link> · Ingeniería Aeronáutica, Universidad Pontificia Bolivariana.
          <br />Datos: Launch Library 2 (The Space Devs) · Mapa: OpenFreeMap, © colaboradores de OpenStreetMap · Clima: Open-Meteo · Órbitas: CelesTrak · Efemérides y asteroides: NASA/JPL · Imagen del día: NASA APOD · Noticias: Spaceflight News API · Resúmenes: Wikipedia. La información oficial pertenece a cada organización.
          <span className="text-fg-dim/70"> · Desarrollo de software: Ing. Ismael Paulino.</span>
        </footer>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
