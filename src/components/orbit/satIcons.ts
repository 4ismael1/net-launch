// Iconos de satélites dibujados en código (sin imágenes externas). Blanco sobre transparente: el shader los tiñe.
export const ICON_KINDS = ["station", "comms", "gnss", "observe", "science", "cubesat", "generic", "debris"] as const;
export type IconKind = (typeof ICON_KINDS)[number];

export const ICON_LABEL: Record<IconKind, string> = {
  station: "Estación tripulada",
  comms: "Comunicaciones",
  gnss: "Navegación (GNSS)",
  observe: "Observación / meteorología",
  science: "Ciencia",
  cubesat: "CubeSat",
  generic: "Satélite",
  debris: "Etapa o desecho",
};

/** Dibuja un icono centrado en una celda de `s`×`s` px. */
export function drawIcon(g: CanvasRenderingContext2D, kind: IconKind, s: number) {
  const c = s / 2, u = s / 32; // unidad
  g.save();
  g.translate(c, c);
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  g.lineWidth = 1.6 * u;
  g.lineCap = "round";
  const panel = (x: number, y: number, w: number, h: number) => {
    g.fillRect(x, y, w, h);
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = 0.9 * u;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + (w * i) / 3, y); g.lineTo(x + (w * i) / 3, y + h); g.stroke(); }
    g.globalCompositeOperation = "source-over";
    g.lineWidth = 1.6 * u;
  };
  switch (kind) {
    case "station": // truss largo + 4 paneles + módulos
      g.fillRect(-13 * u, -1 * u, 26 * u, 2 * u);
      panel(-13 * u, -9 * u, 5 * u, 7 * u); panel(-13 * u, 2 * u, 5 * u, 7 * u);
      panel(8 * u, -9 * u, 5 * u, 7 * u); panel(8 * u, 2 * u, 5 * u, 7 * u);
      g.fillRect(-3 * u, -6 * u, 6 * u, 12 * u);
      g.fillRect(-6 * u, -2.5 * u, 12 * u, 5 * u);
      break;
    case "comms": // cuerpo + dos alas solares largas
      g.fillRect(-3.5 * u, -4 * u, 7 * u, 8 * u);
      g.beginPath(); g.moveTo(-3.5 * u, 0); g.lineTo(-6 * u, 0); g.moveTo(3.5 * u, 0); g.lineTo(6 * u, 0); g.stroke();
      panel(-15 * u, -3.5 * u, 9 * u, 7 * u); panel(6 * u, -3.5 * u, 9 * u, 7 * u);
      break;
    case "gnss": // cuerpo + alas + antena de haz (anillo)
      g.fillRect(-4 * u, -4 * u, 8 * u, 8 * u);
      panel(-14 * u, -2.5 * u, 8 * u, 5 * u); panel(6 * u, -2.5 * u, 8 * u, 5 * u);
      g.beginPath(); g.moveTo(-4 * u, -4 * u); g.lineTo(-6 * u, -9 * u); g.lineTo(6 * u, -9 * u); g.lineTo(4 * u, -4 * u); g.closePath(); g.fill();
      break;
    case "observe": // cuerpo + un panel + lente
      g.fillRect(-4 * u, -5 * u, 8 * u, 10 * u);
      panel(4 * u, -3 * u, 11 * u, 6 * u);
      g.globalCompositeOperation = "destination-out";
      g.beginPath(); g.arc(0, 0, 2.3 * u, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-over";
      g.beginPath(); g.arc(-4 * u, 0, 3.5 * u, Math.PI / 2, (Math.PI * 3) / 2); g.fill();
      break;
    case "science": // telescopio: tubo + parasol
      g.save(); g.rotate(-0.5);
      g.fillRect(-11 * u, -3.5 * u, 18 * u, 7 * u);
      g.beginPath(); g.moveTo(7 * u, -5 * u); g.lineTo(12 * u, -5 * u); g.lineTo(12 * u, 5 * u); g.lineTo(7 * u, 5 * u); g.closePath(); g.stroke();
      panel(-7 * u, -11 * u, 8 * u, 6 * u); panel(-7 * u, 5 * u, 8 * u, 6 * u);
      g.restore();
      break;
    case "cubesat": // cubo en perspectiva
      g.beginPath(); g.moveTo(0, -9 * u); g.lineTo(8 * u, -5 * u); g.lineTo(8 * u, 5 * u); g.lineTo(0, 9 * u); g.lineTo(-8 * u, 5 * u); g.lineTo(-8 * u, -5 * u); g.closePath(); g.fill();
      g.globalCompositeOperation = "destination-out";
      g.beginPath(); g.moveTo(-8 * u, -5 * u); g.lineTo(0, -1 * u); g.lineTo(8 * u, -5 * u); g.moveTo(0, -1 * u); g.lineTo(0, 9 * u); g.stroke();
      g.globalCompositeOperation = "source-over";
      break;
    case "debris": // fragmento irregular
      g.beginPath(); g.moveTo(-6 * u, -3 * u); g.lineTo(2 * u, -7 * u); g.lineTo(7 * u, -1 * u); g.lineTo(3 * u, 6 * u); g.lineTo(-5 * u, 5 * u); g.closePath(); g.fill();
      break;
    default: // satélite genérico
      g.fillRect(-4 * u, -4 * u, 8 * u, 8 * u);
      panel(-13 * u, -3 * u, 8 * u, 6 * u); panel(5 * u, -3 * u, 8 * u, 6 * u);
  }
  g.restore();
}

/** Atlas 4×2 (celdas de 64 px) para el shader de puntos. */
export function buildAtlas(cell = 64) {
  const cv = document.createElement("canvas");
  cv.width = cell * 4;
  cv.height = cell * 2;
  const g = cv.getContext("2d")!;
  ICON_KINDS.forEach((k, i) => {
    g.save();
    g.translate((i % 4) * cell, Math.floor(i / 4) * cell);
    drawIcon(g, k, cell);
    g.restore();
  });
  return cv;
}

/** Icono como data URL (para leyendas en la interfaz). */
export function iconDataUrl(kind: IconKind, size = 32) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size * 2;
  drawIcon(cv.getContext("2d")!, kind, size * 2);
  return cv.toDataURL();
}

/** Tipo de icono a partir del grupo y del nombre del objeto. */
export function iconFor(group: string, name: string): IconKind {
  const n = name.toUpperCase();
  if (/ DEB|R\/B|ROCKET|FREGAT|CZ-|FALCON/.test(n)) return "debris";
  if (group === "stations") return /ISS|CSS|TIANHE|WENTIAN|MENGTIAN|ZARYA|NAUKA|POISK/.test(n) ? "station" : "generic";
  if (["gps-ops", "galileo", "beidou", "glo-ops"].includes(group)) return "gnss";
  if (["weather", "noaa", "resource", "planet"].includes(group)) return "observe";
  if (group === "science") return /HST|HUBBLE|TELESCOPE|XMM|CHANDRA|SWIFT|FERMI|NUSTAR|TESS/.test(n) ? "science" : "generic";
  if (group === "cubesat") return "cubesat";
  if (["starlink", "oneweb", "kuiper", "iridium-NEXT", "geo", "amateur"].includes(group)) return "comms";
  return "generic";
}
