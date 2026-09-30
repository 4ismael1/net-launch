import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarPlus, ChevronRight, ExternalLink, MapPin, Play, ShieldCheck, Info, Orbit } from "lucide-react";
import { getLaunchDetail, getPrerenderSlugs, type LaunchDetail } from "@/lib/data/launch-detail";
import { Card, CardHeader } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { LiveMissionStatus } from "@/components/launch/LiveMissionStatus";
import { LocalTime } from "@/components/launch/LocalTime";
import { MiniMap } from "@/components/map/MiniMap";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { getLaunchNews } from "@/lib/news";
import { NewsRows } from "@/components/news/NewsList";
import { countryName, netLabel, padName, statusInfo } from "@/lib/format";

export async function generateStaticParams() {
  return (await getPrerenderSlugs(12)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/lanzamientos/[slug]">): Promise<Metadata> {
  const d = await getLaunchDetail((await params).slug);
  if (!d) return { title: "Lanzamiento no encontrado" };
  return {
    title: d.l.name,
    description: (d.l.missionDescriptionEs ?? d.l.missionDescription)?.slice(0, 160) ?? `${d.l.name} · ${d.provider?.name ?? ""}`,
    openGraph: d.l.imageUrl ? { images: [d.l.imageUrl] } : undefined,
  };
}

export default function LaunchPage({ params }: PageProps<"/lanzamientos/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[1400px] animate-pulse rounded-lg border border-line bg-surface" />}>
      <LaunchContent params={params} />
    </Suspense>
  );
}

async function LaunchContent({ params }: Pick<PageProps<"/lanzamientos/[slug]">, "params">) {
  const { slug } = await params;
  const d = await getLaunchDetail(slug);
  if (!d) notFound();
  const { l } = d;
  const country = countryName(l.countryCode);

  return (
    <article className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4">
      <nav className="flex items-center gap-1 text-xs text-fg-dim" aria-label="Ruta">
        <Link href="/lanzamientos" className="hover:text-fg">Lanzamientos</Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-fg-muted">{l.name}</span>
      </nav>

      {/* Cabecera */}
      <section className="relative overflow-hidden rounded-lg border border-line bg-surface">
        {l.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.imageUrl} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-30 md:w-1/2" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/40" />
          </>
        )}
        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-5 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <LiveMissionStatus slug={l.slug} part="badge" initial={{ statusAbbrev: l.statusAbbrev, statusName: l.statusName, net: l.net, netPrecision: l.netPrecision, webcastLive: l.webcastLive }} />
          </div>
          <div>
            <p className="num text-sm text-fg-muted">{d.rocket?.fullName ?? d.rocket?.name}</p>
            <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight md:text-4xl">{l.missionName ?? l.name}</h1>
            <p className="mt-2 text-sm text-fg-muted">
              {d.provider && <Link href={`/organizaciones/${d.provider.id}`} className="text-fg hover:underline">{d.provider.name}</Link>}
              {country && <> · <Flag code={l.countryCode} /> {country}</>}
            </p>
          </div>
          <LiveMissionStatus slug={l.slug} part="countdown" initial={{ statusAbbrev: l.statusAbbrev, statusName: l.statusName, net: l.net, netPrecision: l.netPrecision, webcastLive: l.webcastLive }} />
          {l.failReason && (
            <p className="max-w-2xl rounded-md border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-fg">
              <span className="label mr-2 !text-failure">Causa del fallo</span>{l.failReason}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {d.videos.length > 0 && (
              <a href="#transmision" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">
                <Play className="size-4" /> Transmisión
              </a>
            )}
            {l.net && (
              <a href={`/api/ics/${l.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">
                <CalendarPlus className="size-4" /> Añadir al calendario
              </a>
            )}
            {d.pad?.id && (
              <Link href={`/mapa?pad=${d.pad.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">
                <MapPin className="size-4" /> Ver en el mapa
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Misión" meta={l.missionType ?? undefined} />
            <div className="space-y-3 p-4 text-sm leading-relaxed text-fg-muted">
              {l.missionDescription ? (
                l.missionDescriptionEs ? (
                  <>
                    <p className="text-fg">{l.missionDescriptionEs}</p>
                    <details className="text-[11px] text-fg-dim">
                      <summary className="cursor-pointer select-none hover:text-fg-muted">Traducción automática (Gemini) · ver original en inglés (Launch Library 2)</summary>
                      <p lang="en" className="mt-2 text-[13px] leading-relaxed text-fg-muted">{l.missionDescription}</p>
                    </details>
                  </>
                ) : (
                  <>
                    <p lang="en" className="text-fg">{l.missionDescription}</p>
                    <p className="text-[11px] text-fg-dim">Descripción original en inglés (Launch Library 2); la traducción está en cola.</p>
                  </>
                )
              ) : (
                <p>No hay una descripción pública disponible para esta misión.</p>
              )}
              {(d.programs.length > 0 || d.missionAgencies.length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {d.programs.map((p) => <span key={`p${p.id}`} className="rounded-sm border border-line px-2 py-0.5 text-xs text-fg-muted">Programa · {p.name}</span>)}
                  {d.missionAgencies.map((a) => (
                    <Link key={`a${a.id}`} href={`/organizaciones/${a.id}`} className="rounded-sm border border-line px-2 py-0.5 text-xs text-fg-muted hover:text-fg">{a.name}</Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Streams d={d} />
          {d.timeline.length > 0 && <Timeline d={d} />}
          {d.updates.length > 0 && <Updates d={d} />}
          <Suspense fallback={null}><RelatedNews id={l.id} /></Suspense>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title="Datos clave" />
            <dl className="divide-y divide-line text-sm">
              <Row k="Fecha (tu hora)"><LocalTime date={l.net} precision={l.netPrecision} /></Row>
              <Row k="Fecha UTC"><span className="num">{netLabel(l.net, l.netPrecision)}{["SEC", "MIN", "HR"].includes(l.netPrecision ?? "MIN") ? " UTC" : ""}</span></Row>
              {d.location?.timezone && <Row k="Hora local de la base"><span className="num">{netLabel(l.net, l.netPrecision, d.location.timezone)}</span></Row>}
              {l.windowStart && l.windowEnd && l.windowEnd.getTime() !== l.windowStart.getTime() && (
                <Row k="Ventana"><span className="num">{new Intl.DateTimeFormat("es", { timeStyle: "short", timeZone: "UTC" }).format(l.windowStart)}–{new Intl.DateTimeFormat("es", { timeStyle: "short", timeZone: "UTC" }).format(l.windowEnd)} UTC</span></Row>
              )}
              <Row k="Precisión de la fecha">{l.netPrecision ?? "—"}</Row>
              <Row k="Estado"><span title={statusInfo(l.statusAbbrev).hint}>{l.statusName ?? "—"}</span></Row>
              {d.rocket && <Row k="Cohete"><Link className="hover:underline" href={`/vehiculos/${d.rocket.id}`}>{d.rocket.fullName ?? d.rocket.name}</Link></Row>}
              {l.orbitName && <Row k="Órbita">{l.orbitName}{l.orbitAbbrev && <span className="text-fg-dim"> ({l.orbitAbbrev})</span>}</Row>}
              {d.pad && <Row k="Plataforma">{padName(d.pad.name)}</Row>}
              {d.location && <Row k="Base"><Link className="hover:underline" href={`/bases/${d.location.id}`}>{d.location.name}</Link></Row>}
              {d.pad?.latitude != null && d.pad.longitude != null && <Row k="Coordenadas"><span className="num">{d.pad.latitude.toFixed(4)}°, {d.pad.longitude.toFixed(4)}°</span></Row>}
              {l.launchDesignator && <Row k="Designador COSPAR"><span className="num">{l.launchDesignator}</span></Row>}
              {d.attempts.orbitalYear != null && <Row k="Intento orbital del año"><span className="num">#{d.attempts.orbitalYear}</span></Row>}
            </dl>
          </Card>

          {d.pad?.latitude != null && d.pad.longitude != null && (
            <Card className="overflow-hidden">
              <CardHeader title="Ubicación" meta={padName(d.pad.name) ?? undefined} />
              <MiniMap lat={d.pad.latitude} lng={d.pad.longitude} label={padName(d.pad.name) ?? "Plataforma"} />
            </Card>
          )}

          {d.pad?.latitude != null && d.pad.longitude != null && (
            <Suspense fallback={null}>
              <WeatherCard lat={d.pad.latitude} lng={d.pad.longitude} place={d.location?.name ?? padName(d.pad.name) ?? ""}
                t0={["Go", "TBC", "TBD", "Hold"].includes(l.statusAbbrev ?? "") && ["SEC", "MIN", "HR"].includes(l.netPrecision ?? "") ? l.net?.toISOString() ?? null : null} />
            </Suspense>
          )}

          {(l.probability != null || d.weatherConcerns) && (
            <Card>
              <CardHeader title="Meteorología oficial" />
              <div className="space-y-3 p-4 text-sm">
                {l.probability != null && (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-fg-muted">Probabilidad de condiciones favorables</span>
                      <span className="num text-xl">{l.probability} %</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-go" style={{ width: `${l.probability}%` }} /></div>
                  </div>
                )}
                {d.weatherConcerns && <p className="text-fg-muted"><span className="label mr-2">Factores</span>{d.weatherConcerns}</p>}
                <p className="flex gap-1.5 text-[11px] text-fg-dim"><Info className="mt-0.5 size-3 shrink-0" />Pronóstico publicado por el equipo meteorológico de la misión (vía Launch Library 2). No es una predicción de esta plataforma.</p>
              </div>
            </Card>
          )}

          {l.launchDesignator && ["Success", "Partial Failure"].includes(l.statusAbbrev ?? "") && (
            <Card>
              <CardHeader title="Objetos en órbita" meta={`COSPAR ${l.launchDesignator}`} />
              <div className="p-4 text-sm">
                <p className="text-fg-muted">Consulta las cargas útiles y objetos catalogados públicamente tras este lanzamiento, con su órbita calculada.</p>
                <Link href={`/orbita/${l.slug}`} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">
                  <Orbit className="size-4" /> Seguimiento orbital
                </Link>
              </div>
            </Card>
          )}

          {(d.links.length > 0 || d.flightclubUrl) && (
            <Card>
              <CardHeader title="Enlaces" />
              <ul className="divide-y divide-line text-sm">
                {d.links.map((k) => (
                  <li key={k.url}>
                    <a href={k.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0"><span className="block truncate">{k.title ?? k.source}</span><span className="text-xs text-fg-dim">{k.typeName ?? k.source}</span></span>
                      <ExternalLink className="size-4 shrink-0 text-fg-dim" />
                    </a>
                  </li>
                ))}
                {d.flightclubUrl && (
                  <li>
                    <a href={d.flightclubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span><span className="block">Flight Club</span><span className="text-xs text-fg-dim">Simulación de trayectoria de terceros (no es telemetría oficial)</span></span>
                      <ExternalLink className="size-4 shrink-0 text-fg-dim" />
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </article>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-fg-dim">{k}</dt>
      <dd className="min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}

function youtubeId(url: string) {
  const m = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m?.[1] ?? null;
}

function Streams({ d }: { d: LaunchDetail }) {
  const official = (t: string | null) => !!t && /^official/i.test(t);
  const sorted = [...d.videos].sort((a, b) => Number(official(b.typeName)) - Number(official(a.typeName)) || (b.priority ?? 0) - (a.priority ?? 0));
  const embed = sorted.find((v) => youtubeId(v.url));
  const embedId = embed && youtubeId(embed.url);
  return (
    <Card>
      <div id="transmision" className="scroll-mt-20" />
      <CardHeader title="Transmisión" meta={sorted.length ? `${sorted.length} enlace${sorted.length > 1 ? "s" : ""}` : undefined} />
      {sorted.length === 0 ? (
        <p className="p-4 text-sm text-fg-dim">No hay transmisiones públicas registradas para este lanzamiento todavía.</p>
      ) : (
        <div>
          {embedId && (
            <div className="border-b border-line">
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${embedId}`}
                  title={embed.title ?? "Transmisión"}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <p className="flex items-center gap-2 px-4 py-2 text-xs text-fg-muted">
                <SourceTag type={embed.typeName} /> {embed.publisher ?? embed.source}
              </p>
            </div>
          )}
          <ul className="divide-y divide-line">
            {sorted.map((v) => (
              <li key={v.url}>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <Play className="size-4 shrink-0 text-fg-dim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{v.title ?? v.url}</span>
                    <span className="flex items-center gap-2 text-xs text-fg-dim"><SourceTag type={v.typeName} /> {v.publisher ?? v.source}{v.language && ` · ${v.language.toUpperCase()}`}</span>
                  </span>
                  <span className="shrink-0 rounded-md border border-line-strong px-2 py-1 font-mono text-[10.5px] tracking-wider">{v.live ? "WATCH LIVE" : "VER"}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SourceTag({ type }: { type: string | null }) {
  if (type && /^official/i.test(type))
    return <span className="inline-flex items-center gap-1 text-go"><ShieldCheck className="size-3.5" /> Transmisión oficial</span>;
  const label = type === "Unofficial Webcast" ? "Cobertura independiente" : type === "Unofficial Re-stream" ? "Retransmisión no oficial" : "Enlace externo";
  return <span className="text-fg-dim">{label}</span>;
}

function Timeline({ d }: { d: LaunchDetail }) {
  const t = (sec: number) => {
    const a = Math.abs(sec), h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = Math.floor(a % 60);
    return `T${sec < 0 ? "−" : "+"}${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  return (
    <Card>
      <CardHeader title="Cronograma previsto" meta="Secuencia planificada, no telemetría" />
      <ol className="relative p-4">
        {d.timeline.map((e, i) => (
          <li key={i} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 pb-3 last:pb-0">
            <span className={`num text-xs ${e.sec === 0 ? "text-accent" : e.sec < 0 ? "text-fg-muted" : "text-flight"}`}>{t(e.sec)}</span>
            <span className="text-sm">
              <span className="text-fg">{e.abbrev}</span>
              {e.description && <span className="block text-xs text-fg-dim">{e.description}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Updates({ d }: { d: LaunchDetail }) {
  return (
    <Card>
      <CardHeader title="Actualizaciones" meta="Launch Library 2" />
      <ul className="divide-y divide-line">
        {d.updates.slice(0, 10).map((u) => (
          <li key={u.id} className="px-4 py-3 text-sm">
            <p className="text-fg">{u.comment}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-dim">
              <LocalTime date={u.created_on} mode="relative" />
              {u.created_by && <span>· {u.created_by}</span>}
              {u.info_url && <a href={u.info_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">· Fuente <ExternalLink className="size-3" /></a>}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function RelatedNews({ id }: { id: string }) {
  await connection(); // noticias al visitar, no durante el build
  const items = await getLaunchNews(id);
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader title="Noticias relacionadas" meta="Spaceflight News API" />
      <NewsRows items={items} />
    </Card>
  );
}
