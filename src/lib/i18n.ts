// Contenido en español: traducciones guardadas por el sincronizador (Gemini) y resúmenes de Wikipedia en español.
import { createHash } from "node:crypto";
import { cacheLife } from "next/cache";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

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

export type WikiSummary = { title: string; extract: string; url: string; thumb?: string };

/** Resumen de Wikipedia en español a partir del enlace de la Wikipedia en inglés (vía enlaces interlingüísticos). */
export async function wikiEs(wikiUrl: string | null | undefined): Promise<WikiSummary | null> {
  "use cache";
  cacheLife("weeks");
  if (!wikiUrl) return null;
  try {
    const u = new URL(wikiUrl);
    const m = u.pathname.match(/\/wiki\/(.+)$/);
    if (!m) return null;
    const lang = u.hostname.split(".")[0];
    let title = decodeURIComponent(m[1]);
    const opts = { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "NET-plataforma-universitaria (UPB)" } };
    if (lang !== "es") {
      const q = new URL("https://en.wikipedia.org/w/api.php");
      Object.entries({ action: "query", prop: "langlinks", lllang: "es", titles: title, redirects: "1", format: "json", formatversion: "2" }).forEach(([k, v]) => q.searchParams.set(k, v));
      const j = await (await fetch(q, opts)).json();
      const es = j?.query?.pages?.[0]?.langlinks?.[0]?.title;
      if (!es) return null;
      title = es;
    }
    const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, opts);
    if (!r.ok) return null;
    const s = await r.json();
    if (s.type === "disambiguation" || !s.extract) return null;
    return { title: s.title, extract: s.extract, url: s.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`, thumb: s.thumbnail?.source };
  } catch {
    return null;
  }
}
