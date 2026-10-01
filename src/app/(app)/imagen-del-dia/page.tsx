import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ExternalLink, MessageSquare } from "lucide-react";
import { apodExplanationEs, getApod } from "@/lib/data/universe";
import { Streamed } from "@/components/ui/Streamed";
import { Card, Empty } from "@/components/ui/Card";
import { ZoomImage } from "@/components/ui/ZoomImage";

export const metadata: Metadata = { title: "Imagen del día" };

export default function Page({ searchParams }: PageProps<"/imagen-del-dia">) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <Streamed fallback={<div className="grid gap-4"><div className="h-[62vh] animate-pulse rounded-lg border border-line bg-surface" /><div className="h-40 animate-pulse rounded-lg border border-line bg-surface" /></div>}>
        <Content searchParams={searchParams} />
      </Streamed>
    </div>
  );
}

const day = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es", { ...opts, timeZone: "UTC" });

async function Content({ searchParams }: Pick<PageProps<"/imagen-del-dia">, "searchParams">) {
  const [list, sp] = await Promise.all([getApod(), searchParams]);
  if (!list?.length) return <Card><Empty>La NASA no respondió en este momento. Vuelve a intentarlo en unos minutos.</Empty></Card>;
  const want = typeof sp.d === "string" ? sp.d : null;
  const a = list.find((x) => x.date === want) ?? list[0];
  const isToday = a.date === list[0].date;
  const es = a.explanationEs ?? (await apodExplanationEs(a.explanation));
  const title = a.titleEs ?? a.title;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Imagen protagonista */}
      <article className="relative overflow-hidden rounded-lg border border-line bg-black">
        {a.video ? (
          <iframe src={a.video} title={title} allow="fullscreen; picture-in-picture" className="aspect-video w-full" />
        ) : (
          <ZoomImage key={a.date} src={a.image} full={a.hdurl} alt={a.alt ?? title} priority className="mx-auto max-h-[72vh] min-h-[40vh] w-full object-contain" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black via-black/70 to-transparent px-8 pt-24 pb-7 md:block">
          <p className="label !text-white/70 capitalize">{isToday ? "Hoy · " : ""}{day(a.date)}</p>
          <h1 className="mt-1 max-w-3xl text-4xl font-semibold tracking-tight text-white">{title}</h1>
          {a.titleEs && <p className="mt-1 text-sm text-white/60" lang="en">{a.title}</p>}
        </div>
      </article>
      {/* En móvil el título va debajo para no tapar la imagen */}
      <div className="-mt-2 md:hidden">
        <p className="label capitalize">{isToday ? "Hoy · " : ""}{day(a.date)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {a.titleEs && <p className="mt-0.5 text-sm text-fg-dim" lang="en">{a.title}</p>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <p className="label mb-2">Astronomy Picture of the Day · NASA</p>
          <p className="max-w-3xl text-[15.5px] leading-[1.75] text-fg/90" lang={es ? "es" : "en"}>{es ?? a.explanation}</p>
          {es && (
            <details className="group mt-4 max-w-3xl">
              <summary className="cursor-pointer list-none text-xs text-fg-dim hover:text-fg">Traducción automática (Gemini) · <span className="underline underline-offset-2">ver el texto original</span></summary>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted" lang="en">{a.explanation}</p>
            </details>
          )}
        </section>
        <aside className="grid h-fit gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
          {a.credit && <div><p className="label">Créditos</p><p className="mt-1 text-fg-muted">{a.credit}</p></div>}
          <div className="grid gap-2 border-t border-line pt-3">
            <a href={a.page} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-between gap-2 text-fg-muted hover:text-fg">Ver en APOD <ExternalLink className="size-3.5" /></a>
            {!a.video && <a href={a.hdurl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-between gap-2 text-fg-muted hover:text-fg">Alta resolución <ExternalLink className="size-3.5" /></a>}
            <a href={`https://asterisk.apod.com/discuss_apod.php?date=${a.date.slice(2).replace(/-/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-between gap-2 text-fg-muted hover:text-fg">Foro de discusión <MessageSquare className="size-3.5" /></a>
          </div>
        </aside>
      </div>

      {/* Días anteriores */}
      <section>
        <h2 className="label mb-3 !text-fg-muted">Últimos días</h2>
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
          {list.map((x) => (
            <li key={x.date} className="w-40 shrink-0 snap-start md:w-auto">
              <Link href={x.date === list[0].date ? "/imagen-del-dia" : `/imagen-del-dia?d=${x.date}`} scroll={false} aria-current={x.date === a.date ? "true" : undefined}
                className={clsx("group block overflow-hidden rounded-lg border bg-surface transition-[border-color,transform] duration-300 hover:-translate-y-0.5", x.date === a.date ? "border-accent" : "border-line hover:border-line-strong")}>
                <span className="block aspect-[4/3] overflow-hidden bg-surface-3">
                  {x.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  )}
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block truncate text-xs">{x.titleEs ?? x.title}</span>
                  <span className="block text-[10px] capitalize text-fg-dim">{day(x.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
