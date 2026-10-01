"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

// Límite de error de las secciones: el menú y el pie siguen disponibles
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <p className="label mb-1.5">Error</p>
        <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">No se pudo cargar esta sección</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          Puede ser un fallo momentáneo de la base de datos o de una fuente externa. El resto de la plataforma sigue disponible.
        </p>
      </div>
      <div className="grid-bg flex min-h-[40vh] flex-col items-center justify-center gap-5 rounded-lg border border-line bg-surface px-4 py-12 text-center">
        {error.digest && <p className="num text-xs text-fg-dim">Ref. {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => retry()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">
            <RotateCw className="size-4" /> Reintentar
          </button>
          <Link href="/panel" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">
            Ir al panel
          </Link>
        </div>
      </div>
    </div>
  );
}
