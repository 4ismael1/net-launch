"use client";

// Sustituye al layout raíz cuando este falla: no hay estilos globales, todo va en línea con la paleta
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0b0a", color: "#ecebe6", fontFamily: "system-ui, sans-serif" }}>
        <title>Error · NET</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.12em", color: "#ff5b1f" }}>ERROR</p>
          <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 600 }}>La plataforma no pudo cargarse</h1>
          <p style={{ margin: "8px 0 20px", fontSize: 14, lineHeight: 1.5, color: "#a6a39a" }}>Puede ser un fallo momentáneo. Vuelve a intentarlo en unos segundos.</p>
          {error.digest && <p style={{ margin: "0 0 16px", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#716e66" }}>Ref. {error.digest}</p>}
          <button type="button" onClick={() => retry()} style={{ height: 36, padding: "0 14px", border: 0, borderRadius: 6, background: "#ecebe6", color: "#0b0b0a", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
