import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada" };

// URLs que no corresponden a ninguna ruta: se muestra sin el menú de la aplicación
export default function NotFound() {
  return (
    <main className="grid-bg flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="label !text-accent">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">No encontramos esta página</h1>
      <p className="max-w-md text-sm text-fg-muted">El enlace puede estar mal escrito o la página ya no existe.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/panel" className="inline-flex h-9 items-center rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">Ir al panel</Link>
        <Link href="/lanzamientos" className="inline-flex h-9 items-center rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">Ver lanzamientos</Link>
      </div>
    </main>
  );
}
