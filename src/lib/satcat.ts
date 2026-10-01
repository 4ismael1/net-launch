// Población orbital a partir del catálogo público SATCAT de CelesTrak (todos los objetos catalogados desde 1957).
// Se descarga ~7 MB una vez por semana en el sincronizador y se guarda solo el resumen agregado.

export const SATCAT_URL = "https://celestrak.org/pub/satcat.csv";

export type ObjType = "PAY" | "R/B" | "DEB" | "UNK";
export const OBJ_TYPES: ObjType[] = ["PAY", "R/B", "DEB", "UNK"];
export const OBJ_LABEL: Record<ObjType, string> = { PAY: "Cargas útiles", "R/B": "Etapas de cohete", DEB: "Fragmentos", UNK: "Sin identificar" };

export type Regime = "LEO" | "MEO" | "GEO" | "HEO" | "OTRA";
export type SatcatSummary = {
  at: number;
  total: number; // catalogados en la historia
  onOrbit: number;
  decayed: number;
  active: number; // cargas útiles operativas
  byType: Record<ObjType, number>; // en órbita terrestre
  byRegime: Record<Regime, number>;
  activeByRegime: Record<Regime, number>;
  owners: { code: string; total: number; PAY: number; "R/B": number; DEB: number; UNK: number; active: number }[];
  years: { y: number; PAY: number; "R/B": number; DEB: number; UNK: number; launched: number; decayed: number }[]; // población a fin de año
  recentDecays: { name: string; norad: number; type: ObjType; owner: string; date: string; launch: string }[];
  beyond: { name: string; norad: number; center: string; owner: string; launch: string }[]; // en órbita de otros cuerpos
};

const ACTIVE = new Set(["+", "P", "B", "S", "X"]);

function regime(period: number, apo: number, peri: number): Regime {
  if (!period || !apo) return "OTRA";
  if (apo < 2000) return "LEO";
  if (period > 1400 && period < 1480 && peri > 34000 && apo < 37600) return "GEO";
  const e = (apo - peri) / (apo + peri + 2 * 6371);
  if (e > 0.25) return "HEO";
  if (peri >= 2000 && apo < 35000) return "MEO";
  return "OTRA";
}

export function summarizeSatcat(csv: string, now = Date.now()): SatcatSummary {
  const lines = csv.split(/\r?\n/);
  const head = lines[0].split(",");
  const ix = (k: string) => head.indexOf(k);
  const I = {
    name: ix("OBJECT_NAME"), norad: ix("NORAD_CAT_ID"), type: ix("OBJECT_TYPE"), ops: ix("OPS_STATUS_CODE"), owner: ix("OWNER"),
    launch: ix("LAUNCH_DATE"), decay: ix("DECAY_DATE"), period: ix("PERIOD"), apo: ix("APOGEE"), peri: ix("PERIGEE"), center: ix("ORBIT_CENTER"),
  };
  const zeroT = (): Record<ObjType, number> => ({ PAY: 0, "R/B": 0, DEB: 0, UNK: 0 });
  const zeroR = (): Record<Regime, number> => ({ LEO: 0, MEO: 0, GEO: 0, HEO: 0, OTRA: 0 });
  const s: SatcatSummary = {
    at: now, total: 0, onOrbit: 0, decayed: 0, active: 0, byType: zeroT(), byRegime: zeroR(), activeByRegime: zeroR(),
    owners: [], years: [], recentDecays: [], beyond: [],
  };
  const owners = new Map<string, SatcatSummary["owners"][number]>();
  const thisYear = new Date(now).getUTCFullYear();
  // Altas y bajas por año y tipo → población acumulada
  const add = new Map<number, Record<ObjType, number>>();
  const sub = new Map<number, Record<ObjType, number>>();
  const bump = (m: Map<number, Record<ObjType, number>>, y: number, t: ObjType) => {
    let r = m.get(y);
    if (!r) m.set(y, (r = zeroT()));
    r[t]++;
  };
  const cutoff = new Date(now - 45 * 864e5).toISOString().slice(0, 10);

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const c = l.split(",");
    const t = (OBJ_TYPES.includes(c[I.type] as ObjType) ? c[I.type] : "UNK") as ObjType;
    const decay = c[I.decay];
    const launch = c[I.launch];
    const center = c[I.center];
    s.total++;
    const ly = Number(launch.slice(0, 4));
    if (ly) bump(add, ly, t);
    if (decay) {
      s.decayed++;
      const dy = Number(decay.slice(0, 4));
      if (dy) bump(sub, dy, t);
      if (decay >= cutoff) s.recentDecays.push({ name: c[I.name], norad: Number(c[I.norad]), type: t, owner: c[I.owner], date: decay, launch });
      continue;
    }
    if (center && center !== "EA") {
      if (t === "PAY") s.beyond.push({ name: c[I.name], norad: Number(c[I.norad]), center, owner: c[I.owner], launch });
      continue;
    }
    s.onOrbit++;
    s.byType[t]++;
    const reg = regime(Number(c[I.period]), Number(c[I.apo]), Number(c[I.peri]));
    s.byRegime[reg]++;
    const act = t === "PAY" && ACTIVE.has(c[I.ops]);
    if (act) {
      s.active++;
      s.activeByRegime[reg]++;
    }
    const code = c[I.owner] || "TBD";
    let o = owners.get(code);
    if (!o) owners.set(code, (o = { code, total: 0, PAY: 0, "R/B": 0, DEB: 0, UNK: 0, active: 0 }));
    o.total++;
    o[t]++;
    if (act) o.active++;
  }

  s.owners = [...owners.values()].sort((a, b) => b.total - a.total).slice(0, 16);
  const pop = zeroT();
  for (let y = 1957; y <= thisYear; y++) {
    const a = add.get(y) ?? zeroT();
    const d = sub.get(y) ?? zeroT();
    let launched = 0, decayed = 0;
    for (const t of OBJ_TYPES) {
      pop[t] += a[t] - d[t];
      launched += a[t];
      decayed += d[t];
    }
    s.years.push({ y, ...pop, launched, decayed });
  }
  s.recentDecays.sort((a, b) => b.date.localeCompare(a.date));
  s.recentDecays = s.recentDecays.slice(0, 60);
  s.beyond.sort((a, b) => b.launch.localeCompare(a.launch));
  return s;
}

export async function fetchSatcatSummary() {
  const res = await fetch(SATCAT_URL, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "NET-plataforma-universitaria" } });
  if (!res.ok) throw new Error(`SATCAT ${res.status}`);
  return summarizeSatcat(await res.text());
}

// Propietarios del catálogo SATCAT más frecuentes (códigos de CelesTrak)
export const OWNER_NAME: Record<string, string> = {
  US: "Estados Unidos", CIS: "Rusia / URSS", PRC: "China", FR: "Francia", JPN: "Japón", IND: "India", UK: "Reino Unido",
  ESA: "Agencia Espacial Europea", GER: "Alemania", ITSO: "Intelsat", IT: "Italia", ISS: "Estación Espacial Internacional",
  CA: "Canadá", SPN: "España", ORB: "ORBCOMM", CHBZ: "China / Brasil", GLOB: "Globalstar", SKOR: "Corea del Sur",
  AUS: "Australia", ARGN: "Argentina", SES: "SES", ISRA: "Israel", EUTE: "Eutelsat", TURK: "Turquía", TBD: "Sin determinar",
  BRAZ: "Brasil", NOR: "Noruega", IRAN: "Irán", UAE: "Emiratos Árabes", ASRA: "Austria", NETH: "Países Bajos", SWED: "Suecia",
  INDO: "Indonesia", MEX: "México", THAI: "Tailandia", TWN: "Taiwán", AB: "Arabsat", NKOR: "Corea del Norte", EUME: "EUMETSAT",
  O3B: "O3b", IM: "Inmarsat", FIN: "Finlandia", LUXE: "Luxemburgo", SAUD: "Arabia Saudí", KAZ: "Kazajistán", UKR: "Ucrania",
  COL: "Colombia", PER: "Perú", CHLE: "Chile", ECU: "Ecuador", URY: "Uruguay", VENZ: "Venezuela", BOL: "Bolivia",
};
export const CENTER_NAME: Record<string, string> = { SU: "Sol", MO: "Luna", MA: "Marte", VE: "Venus", JU: "Júpiter", ME: "Mercurio", SA: "Saturno", EL1: "L1", EL2: "L2" };
