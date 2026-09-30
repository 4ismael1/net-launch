import type { Metadata } from "next";
import { ExternalLink, Play, ShieldCheck } from "lucide-react";
import { getEvents, type SpaceEvent } from "@/lib/data/space";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, Empty } from "@/components/ui/Card";
import { LocalTime } from "@/components/launch/LocalTime";
import { Countdown } from "@/components/launch/Countdown";

export const metadata: Metadata = { title: "Eventos" };

const TYPE_ES: Record<string, string> = {
  Docking: "Acoplamiento", Undocking: "Desacoplamiento", "EVA": "Caminata espacial (EVA)", Spacewalk: "Caminata espacial",
  Landing: "Aterrizaje", "Static Fire": "Encendido estático", "Test Flight": "Vuelo de prueba", Berthing: "Atraque",
  Unberthing: "Desatraque", "Press Event": "Rueda de prensa", "Celestial Event": "Evento astronómico", Relocation: "Reubicación",
  "Moon Landing": "Alunizaje", Splashdown: "Amerizaje", "Spacecraft Event": "Evento de nave", Flyby: "Sobrevuelo",
};
const typeEs = (t: string | null) => (t && TYPE_ES[t]) || t || "Evento";

export default async function Page() {
  const data = await getEvents();
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Explorar" title="Eventos espaciales"
        description="Acoplamientos, caminatas espaciales, amerizajes, pruebas y otros hitos que no son lanzamientos. Fuente: Launch Library 2." />
      {!data ? (
        <Card><Empty>Los eventos se cargarán en la próxima sincronización.</Empty></Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Próximos" meta={String(data.upcoming.length)} />
            {data.upcoming.length ? <ul className="divide-y divide-line">{data.upcoming.map((e) => <EventRow key={e.id} e={e} upcoming />)}</ul> : <Empty>Sin eventos programados.</Empty>}
          </Card>
          <Card>
            <CardHeader title="Recientes" />
            {data.previous.length ? <ul className="divide-y divide-line">{data.previous.map((e) => <EventRow key={e.id} e={e} />)}</ul> : <Empty>Sin eventos recientes.</Empty>}
          </Card>
        </div>
      )}
    </div>
  );
}

function EventRow({ e, upcoming }: { e: SpaceEvent; upcoming?: boolean }) {
  const video = e.videos.find((v) => v.official) ?? e.videos[0];
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-surface-3">
        {e.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="label mb-0.5 !text-fg-muted">{typeEs(e.type)}{e.location && <span className="normal-case tracking-normal text-fg-dim"> · {e.location}</span>}</p>
        <p className="text-[14px] leading-snug">{e.name}</p>
        {e.description && <p lang="en" className="mt-1 line-clamp-2 text-xs text-fg-dim">{e.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <LocalTime date={e.date} precision={e.precision} className="num text-fg-muted" />
          {upcoming && <Countdown net={e.date} precision={e.precision} size="sm" status="event" />}
          {e.webcastLive && <span className="rounded-sm bg-failure px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">EN DIRECTO</span>}
          {video && (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
              {video.official ? <ShieldCheck className="size-3.5 text-go" /> : <Play className="size-3.5" />}
              {video.official ? "Transmisión oficial" : "Ver cobertura"}
            </a>
          )}
          {e.links[0] && (
            <a href={e.links[0].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-dim hover:text-fg">
              Más información <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
