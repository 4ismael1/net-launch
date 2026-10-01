"use client";

import { useLayoutEffect } from "react";

/**
 * Marca <html data-{name}> solo mientras la página está visible. Next conserva ocultas las páginas visitadas
 * (React Activity), así que un selector `:has([data-x])` seguiría activo en otras páginas; los efectos, en cambio,
 * se limpian al ocultarse.
 */
export function HtmlFlag({ name }: { name: string }) {
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.setAttribute(`data-${name}`, "");
    return () => el.removeAttribute(`data-${name}`);
  }, [name]);
  return null;
}
