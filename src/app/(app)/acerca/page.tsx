import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, GraduationCap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Acerca del proyecto",
  description: "Proyecto de investigación de Ingeniería Aeronáutica (UPB): pregunta, objetivos y cómo la plataforma centraliza la información sobre lanzamientos espaciales.",
};

const OBJECTIVES = [
  {
    n: "1",
    text: "Identificar las fuentes de datos (APIs públicas) y las variables clave de las misiones: fecha, operador, geolocalización de la plataforma y estado de vuelo.",
    done: "Launch Library 2 como fuente principal, complementada con Open-Meteo, CelesTrak y Spaceflight News. Cada lanzamiento integra fecha y precisión, operador, plataforma con coordenadas y estado.",
    links: [["Metodología y fuentes", "/metodologia"], ["Lanzamientos", "/lanzamientos"]],
  },
  {
    n: "2",
    text: "Diseñar la arquitectura de software y la interfaz integrando Sistemas de Información Geográfica (SIG) en un solo entorno web.",
    done: "Mapa WebGIS con las plataformas del mundo, agrupación, filtros por país y operador, vista de globo y fichas por base; sincronización programada y caché para respetar los límites de las APIs.",
    links: [["Mapa mundial", "/mapa"], ["Bases espaciales", "/bases"]],
  },
  {
    n: "3",
    text: "Evaluar la funcionalidad mediante pruebas de integración de datos en tiempo real y pruebas de usabilidad.",
    done: "Actualización en vivo sin recargar la página, indicadores de frescura de los datos y estadísticas de concentración (HHI) que cuantifican la asimetría informativa.",
    links: [["Panel en vivo", "/panel"], ["Estadísticas", "/estadisticas"]],
  },
];

export default function Page() {
  return (
    <div className="mx-auto grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-5">
      {/* Autoría: protagonismo de la investigación */}
      <header className="rounded-lg border border-line bg-surface p-6 md:p-8">
        <p className="label mb-3 flex items-center gap-2 !text-accent"><GraduationCap className="size-4" /> Proyecto de investigación</p>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-4xl">
          Desarrollo de una plataforma web de información para lanzamientos espaciales en tiempo real
        </h1>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <p className="label mb-2">Autoras</p>
            <p className="text-lg font-medium">Ana Isabel Ruiz Gómez</p>
            <p className="text-lg font-medium">Yeslei Vannesa Mora Gómez</p>
            <p className="mt-1 text-sm text-fg-muted">Programa de Ingeniería Aeronáutica</p>
          </div>
          <div className="text-sm">
            <p className="label mb-2">Institución</p>
            <p className="text-fg">Universidad Pontificia Bolivariana</p>
            <p className="text-fg-muted">Facultad de Ingeniería Aeronáutica</p>
            <p className="mt-3 text-fg-muted">Asignatura: Metodología de la Investigación</p>
            <p className="text-fg-muted">Docente: Prof. Carolina Buitrago Arias</p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader title="Pregunta de investigación" />
        <blockquote className="border-l-2 border-accent px-5 py-4 text-[15px] leading-relaxed text-fg">
          ¿Cómo afecta la dispersión de la información sobre lanzamientos espaciales en tiempo real el acceso oportuno y centralizado
          para estudiantes, investigadores y entusiastas del sector aeroespacial?
        </blockquote>
      </Card>

      <Card>
        <CardHeader title="Objetivo general" />
        <p className="p-5 text-sm leading-relaxed text-fg-muted">
          Desarrollar una plataforma web de información interactiva que centralice los datos de lanzamientos espaciales a nivel global,
          con el propósito de mitigar la dispersión informativa y facilitar el acceso oportuno a estudiantes, investigadores y entusiastas del sector aeroespacial.
        </p>
      </Card>

      <Card>
        <CardHeader title="Objetivos específicos y cómo los cumple la plataforma" />
        <ol className="divide-y divide-line">
          {OBJECTIVES.map((o) => (
            <li key={o.n} className="grid gap-3 p-5 md:grid-cols-[40px_minmax(0,1fr)]">
              <span className="num text-2xl text-accent">{o.n}</span>
              <div className="min-w-0">
                <p className="text-sm text-fg">{o.text}</p>
                <p className="mt-2 text-sm text-fg-muted"><span className="label mr-2">En la plataforma</span>{o.done}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.links.map(([l, h]) => (
                    <Link key={h} href={h} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs text-fg-muted hover:border-line-strong hover:text-fg">
                      {l} <ArrowRight className="size-3" />
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Colaboración técnica: reconocimiento transparente y secundario (rol «Software», taxonomía CRediT) */}
      <section className="flex items-start gap-3 rounded-lg border border-line px-5 py-4 text-sm">
        <Code2 className="mt-0.5 size-4 shrink-0 text-fg-dim" />
        <div>
          <p className="label mb-1">Colaboración técnica</p>
          <p className="text-fg-muted">
            Desarrollo de software: <span className="text-fg">Ing. Ismael Paulino</span>, Ingeniero de Software.
          </p>
          <p className="mt-1 text-xs text-fg-dim">
            La investigación, el planteamiento, la metodología y la evaluación corresponden a las autoras.
          </p>
        </div>
      </section>
    </div>
  );
}
