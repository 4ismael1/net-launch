"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

/** Imagen que se abre a pantalla completa (Esc o clic para cerrar). Carga la versión grande solo al abrir. */
export function ZoomImage({ src, full, alt, className, priority }: { src: string; full: string; alt: string; className?: string; priority?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group relative block w-full cursor-zoom-in" aria-label="Ver a pantalla completa">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} fetchPriority={priority ? "high" : "auto"} decoding="async" className={className} />
        <span className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-md bg-bg/60 text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"><Maximize2 className="size-4" /></span>
      </button>
      {open && createPortal(
        <div role="dialog" aria-label={alt} className="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-black/95 p-2 md:p-6" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={full} alt={alt} decoding="async" className="max-h-full max-w-full object-contain" />
          <button className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20" aria-label="Cerrar"><X className="size-5" /></button>
        </div>,
        document.body,
      )}
    </>
  );
}
