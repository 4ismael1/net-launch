// Contenido en español: traducciones guardadas por el sincronizador (Gemini) y resúmenes de Wikipedia en español.
import { createHash } from "node:crypto";
import { cacheLife } from "next/cache";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { translateBatch } from "@/lib/translate";

const md5 = (t: string) => createHash("md5").update(t, "utf8").digest("hex");

/** Traducciones disponibles para varios textos a la vez (una sola consulta). */
export async function translationsFor(texts: (string | null | undefined)[]): Promise<Record<string, string>> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  const uniq = [...new Set(texts.filter((t): t is string => !!t && t.length > 12))];
  if (!uniq.length) return {};
  const byHash = new Map(uniq.map((t) => [md5(t), t]));
  const rows = await db
    .select({ hash: schema.translations.hash, es: schema.translations.es })
    .from(schema.translations)
    .where(inArray(schema.translations.hash, [...byHash.keys()]));
  const out: Record<string, string> = {};
  for (const r of rows) if (r.es) out[byHash.get(r.hash)!] = r.es;
  return out;
}

export async function translationFor(text: string | null | undefined) {
  if (!text) return null;
  return (await translationsFor([text]))[text] ?? null;
}

export type WikiSummary = { title: string; extract: string; url: string; thumb?: string; image?: string };

const WIKI_UA = { "User-Agent": "NET-plataforma-universitaria/1.0 (https://net-launch.vercel.app; proyecto académico UPB)", "Api-User-Agent": "NET-plataforma-universitaria/1.0" };

async function wikiFetch(wikiUrl: string): Promise<WikiSummary | null> {
  const u = new URL(wikiUrl);
  const m = u.pathname.match(/\/wiki\/(.+)$/);
  if (!m) return null;
  const lang = u.hostname.split(".")[0];
  let title = decodeURIComponent(m[1]);
  if (lang !== "es") {
    const q = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    Object.entries({ action: "query", prop: "langlinks", lllang: "es", titles: title, redirects: "1", format: "json", formatversion: "2" }).forEach(([k, v]) => q.searchParams.set(k, v));
    const r = await fetch(q, { signal: AbortSignal.timeout(6000), headers: WIKI_UA });
    if (!r.ok) throw new Error(`wiki ${r.status}`);
    const es = (await r.json())?.query?.pages?.[0]?.langlinks?.[0]?.title;
    if (!es) return null; // no hay artículo en español (resultado válido, se cachea)
    title = es;
  }
  const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { signal: AbortSignal.timeout(6000), headers: WIKI_UA });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`wiki ${r.status}`);
  const s = await r.json();
  if (s.type === "disambiguation" || !s.extract) return null;
  return { title: s.title, extract: s.extract, url: s.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`, thumb: s.thumbnail?.source, image: s.originalimage?.source };
}

/** Resumen de Wikipedia en español a partir del enlace de la Wikipedia en inglés (vía enlaces interlingüísticos). */
export async function wikiEs(wikiUrl: string | null | undefined): Promise<WikiSummary | null> {
  "use cache";
  if (!wikiUrl) { cacheLife("weeks"); return null; }
  try {
    const out = await wikiFetch(wikiUrl);
    cacheLife("weeks");
    return out;
  } catch {
    // Fallo puntual (red, límite): caché corta para reintentar pronto
    cacheLife({ stale: 60, revalidate: 600, expire: 3600 });
    return null;
  }
}

/**
 * Como translationsFor, pero traduce al momento lo que falte (Gemini) y lo guarda. Solo para contenidos
 * diarios y cortos (p. ej. la imagen del día), siempre dentro de una función cacheada.
 */
export async function ensureEs(texts: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniq = [...new Set(texts.filter((t): t is string => !!t && t.length > 12))];
  if (!uniq.length) return {};
  const byHash = new Map(uniq.map((t) => [md5(t), t]));
  const rows = await db.select({ hash: schema.translations.hash, es: schema.translations.es }).from(schema.translations).where(inArray(schema.translations.hash, [...byHash.keys()]));
  const out: Record<string, string> = {};
  for (const r of rows) if (r.es) out[byHash.get(r.hash)!] = r.es;
  const missing = uniq.filter((t) => !out[t]);
  if (missing.length) {
    try {
      const tr = await translateBatch(missing);
      if (tr) {
        await db.insert(schema.translations).values(missing.map((t, i) => ({ hash: md5(t), src: t, es: tr[i] }))).onConflictDoNothing();
        missing.forEach((t, i) => (out[t] = tr[i]));
      }
    } catch {
      // sin traducción: se muestra el original
    }
  }
  return out;
}
