// Noticias (Spaceflight News API v4, de The Space Devs; gratuita y vinculada por ID de lanzamiento).
import { cacheLife } from "next/cache";

export type Article = { id: number; title: string; url: string; image: string | null; site: string; summary: string; publishedAt: string; launches: string[] };

async function fetchPage(query: string): Promise<{ items: Article[]; count: number } | null> {
  try {
    const res = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return { count: j.count ?? 0, items: mapArticles(j.results ?? []) };
  } catch {
    return null;
  }
}

async function fetchArticles(query: string): Promise<Article[] | null> {
  return (await fetchPage(query))?.items ?? null;
}

function mapArticles(results: unknown[]): Article[] {
  return (results as Record<string, unknown>[]).map((a: Record<string, unknown>) => ({
      id: a.id as number,
      title: a.title as string,
      url: a.url as string,
      image: (a.image_url as string) || null,
      site: a.news_site as string,
      summary: String(a.summary ?? "").replace(/\r?\nThe post [\s\S]*$/, "").trim(),
      publishedAt: a.published_at as string,
      launches: ((a.launches as { launch_id: string }[]) ?? []).map((l) => l.launch_id),
    }));
}

export const NEWS_PAGE = 24;

/** Noticias con búsqueda, filtro por medio y paginación. */
export async function getNews(opts: { q?: string; site?: string; page?: number }) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  const p = new URLSearchParams({ limit: String(NEWS_PAGE), offset: String(((opts.page ?? 1) - 1) * NEWS_PAGE), ordering: "-published_at" });
  if (opts.q) p.set("search", opts.q);
  if (opts.site) p.set("news_site", opts.site);
  return fetchPage(p.toString());
}

export async function getNewsSites() {
  "use cache";
  cacheLife("days");
  try {
    const r = await fetch("https://api.spaceflightnewsapi.net/v4/info/", { signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()).news_sites as string[]) ?? [] : [];
  } catch {
    return [];
  }
}

export async function getLaunchNews(launchId: string) {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600, expire: 6 * 3600 });
  return fetchArticles(`limit=6&launch=${launchId}&ordering=-published_at`);
}
