import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getApod, type Apod } from "@/lib/data/universe";
import { PageHeader } from "@/components/ui/PageHeader";
import { Streamed } from "@/components/ui/Streamed";
import { Card, Empty } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Imagen del día" };

export default function Page({ searchParams }: PageProps<"/imagen-del-dia">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Universo" title="Imagen astronómica del día"
        description="Cada día, una imagen o video del universo seleccionado y explicado por astrónomos profesionales (Astronomy Picture of the Day, NASA). Explicación traducida al español." />
      <Streamed fallback={<div className="h-[70vh] animate-pulse rounded-lg border border-line bg-surface" />}>
        <Content searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Media({ a, priority }: { a: Apod; priority?: boolean }) {
  if (a.media === "video") {
    const embed = /youtube\.com|youtu\.be|vimeo\.com/.test(a.url);
    return embed ? (
      <iframe src={a.url} title={a.title} allow="fullscreen; picture-in-picture" loading="lazy" className="aspect-video w-full bg-black" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.thumb ?? ""} alt={a.title} className="w-full object-cover" /></a>
    );
  }
  return (
    <a href={a.hdurl ?? a.url} target="_blank" rel="noopener noreferrer" className="block bg-black" title="Abrir en alta resolución">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.url} alt={a.titleEs ?? a.title} fetchPriority={priority ? "high" : "auto"} decoding="async" className="mx-auto max-h-[78vh] w-auto max-w-full object-contain" />
    </a>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/imagen-del-dia">, "searchParams">) {
  const [list, sp] = await Promise.all([getApod(), searchParams]);
  if (!list?.length) return <Card><Empty>La NASA no respondió en este momento. Vuelve a intentarlo en unos minutos.</Empty></Card>;
  const want = typeof sp.d === "string" ? sp.d : null;
  const a = list.find((x) => x.date === want) ?? list[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <article className="overflow-hidden rounded-lg border border-line bg-surface">
        <Media a={a} priority />
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:p-6">
          <div>
            <p className="label mb-1 capitalize">{day(a.date)}</p>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{a.titleEs ?? a.title}</h2>
            {a.titleEs && <p className="mt-0.5 text-sm text-fg-dim" lang="en">{a.title}</p>}
            <p className="mt-4 text-[15px] leading-relaxed text-fg-muted" lang={a.explanationEs ? "es" : "en"}>{a.explanationEs ?? a.explanation}</p>
            <p className="mt-3 text-[11px] text-fg-dim">{a.explanationEs ? "Traducción automática (Gemini) del texto original de APOD." : "Texto original en inglés."}</p>
          </div>
          <aside className="grid content-start gap-3 text-sm">
            {a.copyright && <p className="text-fg-muted"><span className="label block">Créditos</span>{a.copyright}</p>}
            <a href={`https://apod.nasa.gov/apod/ap${a.date.slice(2).replace(/-/g, "")}.html`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm hover:bg-surface-2">Ver en APOD <ExternalLink className="size-3.5" /></a>
            {a.hdurl && <a href={a.hdurl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-fg-muted hover:text-fg">Alta resolución <ExternalLink className="size-3" /></a>}
          </aside>
        </div>
      </article>

      <section>
        <h2 className="label mb-3 !text-fg-muted">Días anteriores</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.map((x) => (
            <li key={x.date}>
              <Link href={`/imagen-del-dia?d=${x.date}`} aria-current={x.date === a.date ? "true" : undefined}
                className="group block overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-strong aria-[current]:border-accent">
                <span className="block aspect-[4/3] overflow-hidden bg-surface-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.media === "video" ? x.thumb ?? "" : x.url} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block truncate text-xs">{x.titleEs ?? x.title}</span>
                  <span className="num block text-[10px] text-fg-dim">{x.date}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
