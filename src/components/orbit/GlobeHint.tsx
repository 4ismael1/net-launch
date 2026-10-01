"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Aviso breve cuando se usa la rueda sin Ctrl/⌘ sobre un globo (la rueda sola desplaza la página, como en ZoomPan). */
export function useWheelHint() {
  const [show, setShow] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ping = useCallback(() => { setShow(true); clearTimeout(t.current); t.current = setTimeout(() => setShow(false), 1200); }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return [show, ping] as const;
}

export function GlobeHint({ show }: { show: boolean }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit rounded-md bg-bg/90 px-2.5 py-1 text-xs text-fg-muted shadow transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}>
      Ctrl o ⌘ + rueda para acercar
    </span>
  );
}
