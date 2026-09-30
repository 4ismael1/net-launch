import { Suspense, ViewTransition } from "react";
import { Sidebar, MobileNav } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<div className="sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r border-line md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pt-5 pb-24 md:px-6 md:pb-10">
          <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">{children}</ViewTransition>
        </main>
        <footer data-app-footer className="hidden border-t border-line px-6 py-4 text-[11px] text-fg-dim md:block">
          Datos: Launch Library 2 (The Space Devs) · Cartografía © OpenStreetMap · Clima: Open-Meteo · Órbitas: CelesTrak.
          Proyecto académico; la información oficial pertenece a cada organización.
        </footer>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
