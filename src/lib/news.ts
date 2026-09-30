// Noticias (Spaceflight News API v4, de The Space Devs; gratuita y vinculada por ID de lanzamiento).
import { cacheLife } from "next/cache";

export type Article = { id: number; title: string; url: string; image: string | null; site: string; summary: string; publishedAt: string; launches: string[] };

async function fetchArticles(query: string): Promise<Article[] | null> {
  try {
    const res = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.results ?? []).map((a: Record<string, unknown>) => ({
      id: a.id as number,
      title: a.title as string,
      url: a.url as string,
      image: (a.image_url as string) || null,
      site: a.news_site as string,
      summary: String(a.summary ?? "").replace(/\r?\nThe post [\s\S]*$/, "").trim(),
      publishedAt: a.published_at as string,
      launches: ((a.launches as { launch_id: string }[]) ?? []).map((l) => l.launch_id),
    }));
  } catch {
    return null;
  }
}

export async function getLatestNews(offset = 0) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  return fetchArticles(`limit=24&offset=${offset}&ordering=-published_at`);
}

export async function getLaunchNews(launchId: string) {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600, expire: 6 * 3600 });
  return fetchArticles(`limit=6&launch=${launchId}&ordering=-published_at`);
}
