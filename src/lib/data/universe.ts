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
  { id: -31, wiki: "https://en.wikipedia.org/wiki/Voyager_1", name: "Voyager 1", agency: "NASA", launched: "1977-09-05", note: "El objeto humano más lejano. Cruzó la heliopausa en 2012." },
  { id: -32, wiki: "https://en.wikipedia.org/wiki/Voyager_2", name: "Voyager 2", agency: "NASA", launched: "1977-08-20", note: "La única nave que ha visitado Urano y Neptuno." },
  { id: -98, wiki: "https://en.wikipedia.org/wiki/New_Horizons", name: "New Horizons", agency: "NASA", launched: "2006-01-19", note: "Sobrevoló Plutón (2015) y Arrokoth (2019) en el cinturón de Kuiper." },
  { id: -96, wiki: "https://en.wikipedia.org/wiki/Parker_Solar_Probe", name: "Parker Solar Probe", agency: "NASA", launched: "2018-08-12", note: "El objeto más rápido construido: atraviesa la corona del Sol." },
  { id: -144, wiki: "https://en.wikipedia.org/wiki/Solar_Orbiter", name: "Solar Orbiter", agency: "ESA/NASA", launched: "2020-02-10", note: "Fotografía los polos del Sol desde órbitas inclinadas." },
  { id: -121, wiki: "https://en.wikipedia.org/wiki/BepiColombo", name: "BepiColombo", agency: "ESA/JAXA", launched: "2018-10-20", note: "Rumbo a Mercurio con dos orbitadores." },
  { id: -61, wiki: "https://en.wikipedia.org/wiki/Juno_(spacecraft)", name: "Juno", agency: "NASA", launched: "2011-08-05", note: "Estudia Júpiter desde una órbita polar." },
  { id: -159, wiki: "https://en.wikipedia.org/wiki/Europa_Clipper", name: "Europa Clipper", agency: "NASA", launched: "2024-10-14", note: "En camino a Júpiter para estudiar la luna Europa." },
  { id: -28, wiki: "https://en.wikipedia.org/wiki/Jupiter_Icy_Moons_Explorer", name: "JUICE", agency: "ESA", launched: "2023-04-14", note: "Explorará las lunas heladas de Júpiter." },
  { id: -49, wiki: "https://en.wikipedia.org/wiki/Lucy_(spacecraft)", name: "Lucy", agency: "NASA", launched: "2021-10-16", note: "Visita a los asteroides troyanos de Júpiter." },
  { id: -255, wiki: "https://en.wikipedia.org/wiki/Psyche_(spacecraft)", name: "Psyche", agency: "NASA", launched: "2023-10-13", note: "Hacia un asteroide metálico." },
  { id: -64, wiki: "https://en.wikipedia.org/wiki/OSIRIS-REx", name: "OSIRIS-APEX", agency: "NASA", launched: "2016-09-08", note: "Trajo muestras de Bennu; ahora rumbo a Apofis (2029)." },
  { id: -91, wiki: "https://en.wikipedia.org/wiki/Hera_(space_mission)", name: "Hera", agency: "ESA", launched: "2024-10-07", note: "Revisará el asteroide Dimorphos tras el impacto de DART." },
  { id: -170, wiki: "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope", name: "James Webb", agency: "NASA/ESA/CSA", launched: "2021-12-25", note: "Telescopio en el punto L2, a 1,5 millones de km de la Tierra." },
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
// APOD se mudó a science.nasa.gov y la API de api.nasa.gov quedó devolviendo el logotipo de la NASA como imagen.
// Fuente: el feed RSS oficial "APOD Basic" (últimos 30 días, con imagen, explicación y créditos).

export type Apod = {
  date: string; title: string; titleEs: string | null; explanation: string; explanationEs: string | null;
  image: string; thumb: string; hdurl: string; page: string; video: string | null; credit: string | null; alt: string | null;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const tag = (it: string, t: string) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() ?? null;
const text = (h: string | null) =>
  h ? h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&#0?38;|&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&quot;|&#8220;|&#8221;/g, "\"").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").trim() : null;
// Las imágenes de assets.science.nasa.gov admiten redimensionado por parámetros
const sized = (u: string, w: number, h?: number) => {
  try {
    const x = new URL(u.replace(/&#0?38;/g, "&"));
    x.searchParams.set("w", String(w));
    if (h) { x.searchParams.set("h", String(h)); x.searchParams.set("fit", "crop"); } else { x.searchParams.delete("h"); x.searchParams.set("fit", "clip"); }
    return x.toString();
  } catch { return u; }
};

export async function getApod() {
  "use cache";
  cacheLife({ stale: 600, revalidate: 1800, expire: 86400 * 2 });
  try {
    const r = await fetch("https://science.nasa.gov/feed/apod-basic/", { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 (NET-plataforma-universitaria)" } });
    if (!r.ok) return null;
    const xml = await r.text();
    const list: Apod[] = [];
    for (const it of xml.split("<item>").slice(1)) {
      const link = tag(it, "link") ?? "";
      const m = link.match(/apod-(\d{4})-([a-z]+)-(\d{1,2})/);
      const date = m ? `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[3].padStart(2, "0")}` : new Date(tag(it, "pubDate") ?? Date.now()).toISOString().slice(0, 10);
      const hd = (tag(it, "apod:hdurl") ?? "").replace(/&#0?38;/g, "&");
      const isVideo = /youtube|youtu\.be|vimeo|\.mp4/i.test(hd);
      // Explicación sin el prefijo "Explanation:" ni los avisos que APOD añade al final
      const expl = (text(tag(it, "apod:explanation")) ?? "").replace(/^Explanation:\s*/i, "").split(/\n\s*\n/)[0].trim();
      if (!hd || !expl) continue;
      list.push({
        date, title: text(tag(it, "title")) ?? "APOD", titleEs: null, explanation: expl, explanationEs: null,
        image: isVideo ? "" : sized(hd, 1800), thumb: isVideo ? "" : sized(hd, 480, 360), hdurl: hd, page: link, video: isVideo ? hd : null,
        credit: text(tag(it, "apod:copyright")) || text(tag(it, "apod:credit")), alt: text(tag(it, "apod:alt")),
      });
    }
    list.sort((a, b) => b.date.localeCompare(a.date));
    const recent = list.slice(0, 14);
    // Traducción guardada en la BD (una vez por texto): títulos de todos + explicaciones de los 3 más recientes
    const es = await ensureEs([...recent.map((x) => x.title), ...recent.slice(0, 3).map((x) => x.explanation)]);
    return recent.map((x) => ({ ...x, titleEs: es[x.title] ?? null, explanationEs: es[x.explanation] ?? null }));
  } catch {
    return null;
  }
}

/** Traducción de la explicación de un día concreto (al abrirlo desde la galería). */
export async function apodExplanationEs(text: string) {
  "use cache";
  cacheLife("weeks");
  return (await ensureEs([text]))[text] ?? null;
}
