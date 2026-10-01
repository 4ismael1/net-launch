import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { translationFor, wikiEs } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";

/**
 * Descripción en español: traducción de la ficha de LL2 (si ya existe) + resumen de Wikipedia en español,
 * que llega en streaming sin retrasar el resto de la página.
 */
export async function About({ title = "Descripción", text, esOverride, wikiUrl }: { title?: string; text?: string | null; esOverride?: string | null; wikiUrl?: string | null }) {
  const es = esOverride ?? (await translationFor(text));
  if (!text && !wikiUrl) return null;
  // Sin texto propio, la tarjeta depende solo de Wikipedia: si no hay artículo, no se muestra una tarjeta vacía.
  if (!text) {
    const w = await wikiEs(wikiUrl);
    if (!w) return null;
    return (
      <Card>
        <CardHeader title={title} />
        <WikiBody w={w} bordered={false} />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title={title} />
      {text && (
        <div className="p-4">
          <p lang={es ? "es" : "en"} className="text-sm leading-relaxed">{es ?? text}</p>
          <p className="mt-2 text-[11px] text-fg-dim">{es ? "Launch Library 2 · traducción automática (Gemini)" : "Launch Library 2 · texto original en inglés"}</p>
        </div>
      )}
      <Suspense fallback={wikiUrl ? <div className="mx-4 mb-4 h-16 animate-pulse rounded-md bg-surface-2" /> : null}>
        <Wiki url={wikiUrl} bordered={!!text} />
      </Suspense>
    </Card>
  );
}

async function Wiki({ url, bordered }: { url?: string | null; bordered: boolean }) {
  const w = await wikiEs(url);
  if (!w) return null;
  return <WikiBody w={w} bordered={bordered} />;
}

function WikiBody({ w, bordered }: { w: NonNullable<Awaited<ReturnType<typeof wikiEs>>>; bordered: boolean }) {
  return (
    <div className={bordered ? "animate-fade-in border-t border-line p-4" : "animate-fade-in p-4"}>
      <div className="flex gap-3">
        {w.thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.thumb} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-md object-cover opacity-90" />
        )}
        <p className="line-clamp-6 text-sm leading-relaxed text-fg-muted">{w.extract}</p>
      </div>
      <a href={w.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-fg-dim transition-colors hover:text-fg">
        Wikipedia en español · {w.title} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
