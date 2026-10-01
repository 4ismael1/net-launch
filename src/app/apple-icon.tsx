import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icono para la pantalla de inicio (iOS/Android): logo NET sobre grafito. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0b0a" }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <ellipse cx="32" cy="32" rx="24" ry="10" transform="rotate(-28 32 32)" fill="none" stroke="#a6a39a" strokeOpacity="0.55" strokeWidth="3" />
          <circle cx="32" cy="32" r="8" fill="none" stroke="#ecebe6" strokeWidth="3.5" />
          <circle cx="51.5" cy="21" r="5" fill="#ff5b1f" />
        </svg>
      </div>
    ),
    size,
  );
}
