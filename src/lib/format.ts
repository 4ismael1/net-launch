// Formato y semántica de estados. Textos en español; nombres oficiales sin traducir.

export type StatusKey = "go" | "tbc" | "tbd" | "hold" | "flight" | "success" | "failure" | "partial";

const STATUS: Record<string, { key: StatusKey; label: string; hint: string }> = {
  Go: { key: "go", label: "GO", hint: "Fecha confirmada por fuentes oficiales o fiables." },
  TBC: { key: "tbc", label: "TBC", hint: "Por confirmar: fecha anunciada, pendiente de confirmación." },
  TBD: { key: "tbd", label: "TBD", hint: "Por determinar: fecha aún no definida." },
  Hold: { key: "hold", label: "HOLD", hint: "Cuenta regresiva detenida." },
  "In Flight": { key: "flight", label: "EN VUELO", hint: "El vehículo ha despegado." },
  Success: { key: "success", label: "ÉXITO", hint: "Misión completada con éxito." },
  Failure: { key: "failure", label: "FALLO", hint: "El lanzamiento falló." },
  "Partial Failure": { key: "partial", label: "FALLO PARCIAL", hint: "Se cumplió solo parte de los objetivos." },
};

export function statusInfo(abbrev: string | null | undefined) {
  return (abbrev && STATUS[abbrev]) || { key: "tbd" as StatusKey, label: abbrev?.toUpperCase() ?? "—", hint: "" };
}

export const PENDING_STATUSES = ["Go", "TBC", "TBD", "Hold"];
export const DONE_STATUSES = ["Success", "Failure", "Partial Failure"];

/** ¿La fecha es lo bastante precisa como para una cuenta regresiva real? */
export function isPrecise(netPrecision: string | null | undefined) {
  return !netPrecision || ["SEC", "MIN", "HR"].includes(netPrecision);
}

/** ¿Se conoce la hora al minuto? (con HR solo se sabe la hora aproximada: nada de segundos) */
export function isExact(netPrecision: string | null | undefined) {
  return !netPrecision || ["SEC", "MIN"].includes(netPrecision);
}

/** Texto honesto de la fecha según su precisión (NET = no antes de). */
export function netLabel(net: Date | string | null, precision: string | null | undefined, tz?: string) {
  if (!net) return "Sin fecha pública";
  const d = new Date(net);
  const p = precision ?? "MIN";
  // Fechas sin hora (día, mes, trimestre…) son fechas UTC: convertirlas a la zona local cambiaría el día.
  const zone = ["SEC", "MIN", "HR"].includes(p) ? tz ?? "UTC" : "UTC";
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es", { timeZone: zone, ...o }).format(d);
  if (["SEC", "MIN", "HR"].includes(p)) return f({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (p === "DAY") return `NET ${f({ day: "numeric", month: "short", year: "numeric" })}`;
  if (p === "MON" || p === "WK") return `NET ${f({ month: "long", year: "numeric" })}`;
  if (/^Q[1-4]$/.test(p)) return `NET ${p} ${f({ year: "numeric" })}`;
  if (/^H[12]$/.test(p)) return `NET ${p === "H1" ? "1.er" : "2.º"} semestre ${f({ year: "numeric" })}`;
  return `NET ${f({ year: "numeric" })}`;
}

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });
// LL2 usa alpha-3; Intl necesita alpha-2. Tabla de los códigos habituales en datos de lanzamiento.
const A3_A2: Record<string, string> = {
  USA: "US", RUS: "RU", CHN: "CN", IND: "IN", JPN: "JP", FRA: "FR", GUF: "GF", KAZ: "KZ", NZL: "NZ",
  KOR: "KR", PRK: "KP", IRN: "IR", ISR: "IL", BRA: "BR", AUS: "AU", GBR: "GB", NOR: "NO", SWE: "SE",
  DEU: "DE", ITA: "IT", ESP: "ES", KEN: "KE", MHL: "MH", CAN: "CA", ARG: "AR", UKR: "UA", PAK: "PK",
  IDN: "ID", DZA: "DZ", MEX: "MX", PRT: "PT", NLD: "NL", BEL: "BE", CHE: "CH", LUX: "LU", ARE: "AE",
  SAU: "SA", TUR: "TR", EGY: "EG", ZAF: "ZA", TWN: "TW", VNM: "VN", THA: "TH", MYS: "MY", SGP: "SG",
  FIN: "FI", DNK: "DK", AUT: "AT", POL: "PL", CZE: "CZ", HUN: "HU", GRC: "GR", IRL: "IE", NGA: "NG",
  PER: "PE", CHL: "CL", COL: "CO", VEN: "VE", BGD: "BD", LKA: "LK", PHL: "PH", KWT: "KW", QAT: "QA",
  OMN: "OM", BHR: "BH", JOR: "JO", IRQ: "IQ", MAR: "MA", TUN: "TN", ETH: "ET", RWA: "RW", GHA: "GH", UGA: "UG",
  ROU: "RO", BGR: "BG", SVK: "SK", SVN: "SI", HRV: "HR", EST: "EE", LVA: "LV", LTU: "LT", ISL: "IS", BLR: "BY",
  AZE: "AZ", GEO: "GE", ARM: "AM", UZB: "UZ", TKM: "TM", MNG: "MN", NPL: "NP", URY: "UY", BOL: "BO", ECU: "EC",
  PRY: "PY", CRI: "CR", GTM: "GT", CUB: "CU",
};

export function countryName(a3: string | null | undefined) {
  if (!a3) return null;
  const a2 = A3_A2[a3];
  try {
    return a2 ? regionNames.of(a2) ?? a3 : a3;
  } catch {
    return a3;
  }
}

/** Código alpha-2 en minúsculas (para imágenes de bandera). Windows no muestra banderas emoji. */
export function alpha2(a3: string | null | undefined) {
  return (a3 && A3_A2[a3]?.toLowerCase()) || null;
}

export function relativeTime(date: Date | string, now = Date.now()) {
  const diff = new Date(date).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 864e5], ["month", 30 * 864e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4],
  ];
  for (const [u, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), u);
  return rtf.format(Math.round(diff / 1000), "second");
}

/** Descompone milisegundos en T− días/horas/min/seg. */
export function splitCountdown(ms: number) {
  const sign = ms >= 0 ? "−" : "+";
  const t = Math.abs(ms) / 1000;
  return {
    sign,
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: Math.floor(t % 60),
  };
}

/** "1 lanzamiento" / "3 lanzamientos" */
export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("es")} ${n === 1 ? one : many}`;
}

/** LL2 usa "Unknown Pad" cuando la plataforma aún no se ha anunciado. */
export function padName(name: string | null | undefined) {
  if (!name) return null;
  return /^unknown pad$/i.test(name.trim()) ? "Plataforma por confirmar" : name;
}

/** Duración en segundos → "1,2 años" / "34 días" / "5 h" */
export function durLabel(s: number | null | undefined) {
  if (!s) return "—";
  const d = s / 86400;
  if (d >= 365) return `${(Math.round((d / 365.25) * 10) / 10).toLocaleString("es")} años`;
  if (d >= 1) return `${Math.round(d).toLocaleString("es")} días`;
  return `${Math.max(1, Math.round(s / 3600))} h`;
}

/** Tamaño de un asteroide: diámetro medido o rango estimado por magnitud absoluta */
export function sizeLabel(r: { diamKnown: number | null; diam: [number, number] | null }) {
  const f = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);
  if (r.diamKnown) return f(r.diamKnown);
  if (!r.diam) return "tamaño desconocido";
  return `${f(r.diam[0])}–${f(r.diam[1])}`;
}
