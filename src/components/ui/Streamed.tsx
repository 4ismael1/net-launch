import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * Suspense con transición: el esqueleto sale rápido y el contenido real entra con fundido + ligero deslizamiento
 * (View Transitions nativas de React/Next). Nada aparece "de golpe".
 */
export function Streamed({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={<ViewTransition exit="vt-skeleton-out" default="none">{fallback}</ViewTransition>}>
      <ViewTransition enter="vt-content-in" default="none">{children}</ViewTransition>
    </Suspense>
  );
}
