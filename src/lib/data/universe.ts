// Universo: población orbital (SATCAT), sondas lejanas (JPL Horizons), asteroides cercanos (JPL CAD), imagen del día (NASA APOD).
import { cacheLife } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SatcatSummary } from "@/lib/satcat";
import { ensureEs } from "@/lib/i18n";

const UA = { "User-Agent": "NET-plataforma-universitaria (UPB)" };

export async function getSatcat() {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600 * 6, expire: 86400 * 14 });
  const [row] = await db.select({ v: schema.syncState.value }).from(schema.syncState).where(eq(schema.syncState.key, "satcat")).limit(1);
  return (row?.v as SatcatSummary | undefined) ?? null;
}

// ───────────── Sondas (JPL Horizons) ─────────────

export const PROBES = [
  { id: -31, name: "Voyager 1", agency: "NASA", launched: "1977-09-05", note: "El objeto humano más lejano. Cruzó la heliopausa en 2012." },
  { id: -32, name: "Voyager 2", agency: "NASA", launched: "1977-08-20", note: "La única nave que ha visitado Urano y Neptuno." },
  { id: -98, name: "New Horizons", agency: "NASA", launched: "2006-01-19", note: "Sobrevoló Plutón (2015) y Arrokoth (2019) en el cinturón de Kuiper." },
  { id: -96, name: "Parker Solar Probe", agency: "NASA", launched: "2018-08-12", note: "El objeto más rápido construido: atraviesa la corona del Sol." },
  { id: -144, name: "Solar Orbiter", agency: "ESA/NASA", launched: "2020-02-10", note: "Fotografía los polos del Sol desde órbitas inclinadas." },
  { id: -121, name: "BepiColombo", agency: "ESA/JAXA", launched: "2018-10-20", note: "Rumbo a Mercurio con dos orbitadores." },
  { id: -61, name: "Juno", agency: "NASA", launched: "2011-08-05", note: "Estudia Júpiter desde una órbita polar." },
  { id: -159, name: "Europa Clipper", agency: "NASA", launched: "2024-10-14", note: "En camino a Júpiter para estudiar la luna Europa." },
  { id: -28, name: "JUICE", agency: "ESA", launched: "2023-04-14", note: "Explorará las lunas heladas de Júpiter." },
  { id: -49, name: "Lucy", agency: "NASA", launched: "2021-10-16", note: "Visita a los asteroides troyanos de Júpiter." },
  { id: -255, name: "Psyche", agency: "NASA", launched: "2023-10-13", note: "Hacia un asteroide metálico." },
  { id: -64, name: "OSIRIS-APEX", agency: "NASA", launched: "2016-09-08", note: "Trajo muestras de Bennu; ahora rumbo a Apofis (2029)." },
  { id: -91, name: "Hera", agency: "ESA", launched: "2024-10-07", note: "Revisará el asteroide Dimorphos tras el impacto de DART." },
  { id: -170, name: "James Webb", agency: "NASA/ESA/CSA", launched: "2021-12-25", note: "Telescopio en el punto L2, a 1,5 millones de km de la Tierra." },
] as const;

export type Sample = [t: number, x: number, y: number, z: number]; // ms, km (heliocéntrico, eclíptica J2000)

/** Efemérides cada 6 h desde hoy 00:00 UTC hasta +4 días: el cliente interpola en tiempo real (error < 1 000 km). */
async function horizons(id: number | string): Promise<Sample[] | null> {
  const day = new Date().toISOString().slice(0, 10);
  const stop = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);
  const q = new URLSearchParams({
    format: "json", COMMAND: `'${id}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'",
    START_TIME: `'${day}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: "'6 h'", VEC_TABLE: "'1'", OUT_UNITS: "'KM-S'", CSV_FORMAT: "'YES'", REF_PLANE: "'ECLIPTIC'",
  });
  try {
    const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`, { signal: AbortSignal.timeout(15_000), headers: UA });
    if (!r.ok) return null;
    const txt: string = (await r.json()).result ?? "";
    const body = txt.split("$$SOE")[1]?.split("$$EOE")[0]?.trim();
    if (!body) return null;
    const out: Sample[] = [];
    for (const line of body.split("\n")) {
      const c = line.split(",").map((x) => x.trim());
      const jd = Number(c[0]);
      const [x, y, z] = c.slice(2, 5).map(Number);
      if (Number.isFinite(jd) && [x, y, z].every(Number.isFinite)) out.push([Math.round((jd - 2440587.5) * 864e5), x, y, z]);
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Posiciones heliocéntricas de la Tierra y de las sondas para los próximos días (JPL Horizons). */
export async function getProbes() {
  "use cache";
  const ids = [399, ...PROBES.map((p) => p.id)];
  const out: (Sample[] | null)[] = [];
  // Horizons pide no saturarlo: de 2 en 2 y un reintento si falla de forma puntual
  const get = async (id: number) => (await horizons(id)) ?? (await new Promise((r) => setTimeout(r, 900)), await horizons(id));
  for (let i = 0; i < ids.length; i += 2) out.push(...(await Promise.all(ids.slice(i, i + 2).map(get))));
  // Si faltó alguna, la caché dura poco para completarla pronto
  cacheLife(out.every(Boolean) ? { stale: 3600, revalidate: 3600 * 12, expire: 86400 * 3 } : { stale: 60, revalidate: 600, expire: 3600 });
  const earth = out[0];
  const probes = PROBES.map((p, i) => ({ ...p, s: out[i + 1] })).filter((p): p is typeof p & { s: Sample[] } => !!p.s);
  return { earth, probes, at: Date.now() };
}

// ───────────── Asteroides cercanos (JPL CAD) ─────────────

export type Approach = { des: string; name: string; date: string; distAu: number; distLd: number; distKm: number; vRel: number; h: number | null; diam: [number, number] | null; diamKnown: number | null; sigma: string };
const AU = 149_597_870.7, LD = 384_400;

// Diámetro estimado a partir de la magnitud absoluta H con albedo 0,05–0,25 (fórmula estándar de la IAU/CNEOS)
function diamFromH(h: number): [number, number] {
  const d = (p: number) => (1329 / Math.sqrt(p)) * 10 ** (-h / 5) * 1000; // metros
  return [d(0.25), d(0.05)];
}

const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
/** "2026-Oct-02 19:28" (UTC) → ISO */
const cadDate = (s: string) => {
  const m = s.match(/(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/);
  return m ? `${m[1]}-${MON[m[2]] ?? "01"}-${m[3]}T${m[4]}:${m[5]}:00Z` : s;
};

export async function getApproaches() {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600 * 3, expire: 86400 * 2 });
  const q = (min: string, max: string, dist: string) =>
    fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${min}&date-max=${max}&dist-max=${dist}&fullname=true&diameter=true&sort=date`, { signal: AbortSignal.timeout(15_000), headers: UA })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const day = new Date().toISOString().slice(0, 10);
  const back = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [j, big] = await Promise.all([
    q(back, "%2B60", "0.05"),
    // Los grandes (H < 22, ~>140 m) que pasan a menos de 0,2 ua en el próximo año
    fetch(`https://ssd-api.jpl.nasa.gov/cad.api?date-min=${day}&date-max=%2B365&dist-max=0.2&h-max=22&fullname=true&diameter=true&sort=dist`, { signal: AbortSignal.timeout(15_000), headers: UA }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const parse = (x: { fields?: string[]; data?: (string | null)[][] } | null): Approach[] => {
    if (!x?.fields || !x.data) return [];
    const f = Object.fromEntries(x.fields.map((k, i) => [k, i]));
    return x.data.map((r) => {
      const au = Number(r[f.dist]);
      const h = r[f.h] ? Number(r[f.h]) : null;
      const dk = r[f.diameter] ? Number(r[f.diameter]) * 1000 : null;
      return {
        des: String(r[f.des]), name: String(r[f.fullname] ?? r[f.des]).trim(), date: cadDate(String(r[f.cd])),
        distAu: au, distLd: (au * AU) / LD, distKm: au * AU, vRel: Number(r[f.v_rel]), h, diam: h != null ? diamFromH(h) : null, diamKnown: dk, sigma: String(r[f.t_sigma_f] ?? ""),
      };
    });
  };
  return { near: parse(j), big: parse(big).slice(0, 12), at: Date.now() };
}

// ───────────── Imagen astronómica del día (NASA APOD) ─────────────

export type Apod = { date: string; title: string; titleEs: string | null; explanation: string; explanationEs: string | null; url: string; hdurl?: string; media: string; thumb?: string; copyright?: string };

export async function getApod() {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600, expire: 86400 * 2 });
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const start = new Date(Date.now() - 11 * 864e5).toISOString().slice(0, 10);
  try {
    const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}&thumbs=true&start_date=${start}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const list = ((await r.json()) as { date: string; title: string; explanation: string; url: string; hdurl?: string; media_type: string; thumbnail_url?: string; copyright?: string }[])
      .filter((x) => x.url)
      .sort((a, b) => b.date.localeCompare(a.date));
    // Traducción (una vez por texto, guardada en la BD): título y explicación de hoy + títulos del resto
    const es = await ensureEs([list[0]?.title, list[0]?.explanation, ...list.slice(1).map((x) => x.title)]);
    return list.map<Apod>((x) => ({
      date: x.date, title: x.title, titleEs: es[x.title] ?? null, explanation: x.explanation, explanationEs: es[x.explanation] ?? null,
      url: x.url, hdurl: x.hdurl, media: x.media_type, thumb: x.thumbnail_url, copyright: x.copyright?.replace(/\s+/g, " ").trim(),
    }));
  } catch {
    return null;
  }
}
