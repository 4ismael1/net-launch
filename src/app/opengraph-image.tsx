import { ImageResponse } from "next/og";

export const alt = "NET · Monitor mundial de lanzamientos espaciales";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vista previa al compartir el enlace (WhatsApp, redes, correo). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b0b0a", color: "#ecebe6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <ellipse cx="32" cy="32" rx="24" ry="10" transform="rotate(-28 32 32)" fill="none" stroke="#a6a39a" strokeOpacity="0.55" strokeWidth="3" />
            <circle cx="32" cy="32" r="8" fill="none" stroke="#ecebe6" strokeWidth="3.5" />
            <circle cx="51.5" cy="21" r="5" fill="#ff5b1f" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>NET</span>
            <span style={{ fontSize: 20, color: "#a6a39a" }}>Monitor mundial de lanzamientos</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 22, color: "#ff5b1f", letterSpacing: 4 }}>PROYECTO DE INVESTIGACIÓN</span>
          <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.08, maxWidth: 1000 }}>Todo lo que despega en el planeta, en un solo lugar.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#a6a39a", borderTop: "1px solid #34332e", paddingTop: 24 }}>
          <span>Ana Isabel Ruiz Gómez · Yeslei Vannesa Mora Gómez</span>
          <span>Ingeniería Aeronáutica · UPB</span>
        </div>
      </div>
    ),
    size,
  );
}
