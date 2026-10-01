import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/launch/StatusBadge";

export const metadata: Metadata = {
  title: "Metodología",
  description: "Cómo se obtienen, actualizan y presentan los datos de la plataforma, sus fuentes públicas y lo que deliberadamente no muestra.",
};

const SOURCES = [
  { name: "Launch Library 2 (The Space Devs)", url: "https://thespacedevs.com/llapi", use: "Fuente principal: lanzamientos, estados, fechas, ventanas, operadores, cohetes, bases, plataformas, transmisiones, eventos, astronautas y estaciones.", freq: "Sincronización cada 15 min (cambios por last_updated); catálogo semanal; instantáneas cada 3 h. Límite respetado: ≤14 peticiones/hora." },
  { name: "OpenStreetMap · OpenFreeMap / MapTiler", url: "https://www.openstreetmap.org/copyright", use: "Cartografía base del mapa mundial y los minimapas.", freq: "Teselas servidas por el proveedor; nunca se usan los servidores públicos de OSM." },
  { name: "Open-Meteo", url: "https://open-meteo.com/", use: "Clima contextual de cada plataforma y pronóstico a la hora prevista.", freq: "Consulta desde el servidor con caché de 30 min." },
  { name: "CelesTrak (GP / OMM · SATCAT)", url: "https://celestrak.org/", use: "Elementos orbitales de los objetos catalogados tras cada lanzamiento, de las estaciones y de los grupos de satélites; catálogo SATCAT para la población orbital.", freq: "Caché de 3 a 6 h (CelesTrak actualiza cada 2 h); SATCAT semanal." },
  { name: "NASA/JPL Horizons", url: "https://ssd.jpl.nasa.gov/horizons/", use: "Efemérides de las sondas del sistema solar (Más allá de la órbita).", freq: "Caché de 12 h." },
  { name: "NASA/JPL CNEOS · SBDB Close-Approach Data", url: "https://ssd-api.jpl.nasa.gov/doc/cad.html", use: "Acercamientos de asteroides y cometas a la Tierra.", freq: "Caché de 3 h." },
  { name: "NASA APOD (Astronomy Picture of the Day)", url: "https://apod.nasa.gov/", use: "Imagen astronómica del día con su explicación y créditos.", freq: "Caché de 30 min." },
  { name: "Spaceflight News API (The Space Devs)", url: "https://spaceflightnewsapi.net/", use: "Noticias de medios especializados y agencias, generales y por lanzamiento.", freq: "Consulta al visitar, con caché de 30 min." },
  { name: "Wikipedia (español)", url: "https://es.wikipedia.org/", use: "Resúmenes e imágenes de organizaciones, bases, vehículos, astronautas y sondas, enlazados a su artículo.", freq: "Caché de semanas." },
  { name: "astronomy-engine", url: "https://github.com/cosinekitty/astronomy", use: "Posiciones del Sol, la Luna y los planetas calculadas en el navegador (Esta noche, Más allá de la órbita).", freq: "Cálculo local, sin peticiones." },
  { name: "Gemini (Google AI Studio)", url: "https://ai.google.dev/", use: "Traducción automática al español de las descripciones de LL2, señalada como tal y con el original disponible.", freq: "Cada texto se traduce una sola vez y se guarda." },
  { name: "Natural Earth (world-atlas)", url: "https://www.naturalearthdata.com/", use: "Contornos continentales del globo 3D (dominio público).", freq: "Estático." },
];

const STATUSES: [string, string][] = [
  ["Go", "Fecha y hora confirmadas por fuentes oficiales o fiables."],
  ["TBC", "Fecha anunciada, pendiente de confirmación."],
  ["TBD", "Fecha aún no definida; suele mostrarse con precisión de mes, trimestre o año."],
  ["Hold", "La cuenta regresiva está detenida."],
  ["In Flight", "El vehículo ha despegado y la misión está en curso."],
  ["Success", "Lanzamiento completado con éxito."],
  ["Partial Failure", "Solo se cumplió parte de los objetivos (p. ej., órbita incorrecta)."],
  ["Failure", "El lanzamiento no alcanzó su objetivo."],
];

export default function Page() {
  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)] gap-4">
      <PageHeader eyebrow="Información" title="Metodología y fuentes"
        description="Cómo se obtienen, actualizan y presentan los datos de esta plataforma, y qué es lo que deliberadamente NO muestra." />

      <Card>
        <CardHeader title="Objetivo" />
        <div className="space-y-3 p-4 text-sm leading-relaxed text-fg-muted">
          <p>
            La información sobre lanzamientos espaciales está dispersa entre agencias, empresas, portales especializados y redes sociales, y la cobertura se concentra en unas pocas organizaciones.
            Esta plataforma, entregable de una investigación académica, <span className="text-fg">centraliza fuentes públicas en un único lugar</span> y las sitúa geográficamente mediante herramientas WebGIS.
          </p>
          <p>
            Para no reproducir ese sesgo, los listados de organizaciones se ordenan alfabéticamente por defecto, existe un orden de «menos conocidas», el panel destaca cada día a un operador fuera de los cinco más activos
            y la sección de Estadísticas mide la concentración con el índice Herfindahl-Hirschman.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Fuentes de datos" />
        <ul className="divide-y divide-line">
          {SOURCES.map((s) => (
            <li key={s.name} className="grid gap-1 px-4 py-3.5 text-sm md:grid-cols-[220px_minmax(0,1fr)] md:gap-4">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 font-medium hover:underline">{s.name} <ExternalLink className="mt-1 size-3 shrink-0 text-fg-dim" /></a>
              <div>
                <p className="text-fg-muted">{s.use}</p>
                <p className="mt-1 text-xs text-fg-dim">{s.freq}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Arquitectura de datos" />
        <ol className="list-decimal space-y-2 py-4 pr-4 pl-9 text-sm text-fg-muted">
          <li>Un proceso programado (GitHub Actions) consulta Launch Library 2 respetando su límite gratuito y guarda los datos normalizados en una base de datos PostgreSQL.</li>
          <li>La web <span className="text-fg">nunca</span> consulta Launch Library 2 directamente: lee de la base de datos y guarda los resultados en caché, así que responde rápido aunque la fuente esté caída.</li>
          <li>Las fuentes complementarias (clima, órbitas) se consultan desde el servidor, con caché y tiempo límite; si fallan, solo se oculta su módulo.</li>
          <li>Las cuentas regresivas se calculan en el navegador a partir de la fecha programada, sin consultar ninguna API cada segundo.</li>
        </ol>
      </Card>

      <Card>
        <CardHeader title="Qué NO muestra esta plataforma" />
        <ul className="space-y-2 p-4 text-sm text-fg-muted">
          <li>• <span className="text-fg">Telemetría de vuelo</span> (posición, velocidad, altitud o combustible del cohete): no existe una fuente pública global, así que no se muestra ni se simula.</li>
          <li>• <span className="text-fg">Predicciones de cancelación:</span> el clima es información contextual; la decisión de lanzar corresponde a la organización responsable. La probabilidad meteorológica que aparece en algunas misiones es la publicada por su equipo oficial.</li>
          <li>• <span className="text-fg">Posiciones «en vivo» de satélites:</span> las posiciones orbitales se <em>calculan</em> con el modelo SGP4 a partir de elementos orbitales públicos, indicando su época.</li>
          <li>• <span className="text-fg">Datos inventados:</span> si un campo no existe en la fuente, se oculta o se indica que no hay información pública.</li>
          <li>• Los «cronogramas previstos» de una misión son la secuencia <em>planificada</em> publicada, no eventos registrados en tiempo real.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Glosario de estados" />
        <dl className="divide-y divide-line">
          {STATUSES.map(([k, v]) => (
            <div key={k} className="flex items-center gap-4 px-4 py-2.5 text-sm">
              <dt className="w-32 shrink-0"><StatusBadge abbrev={k} /></dt>
              <dd className="text-fg-muted">{v}</dd>
            </div>
          ))}
          <div className="flex items-start gap-4 px-4 py-2.5 text-sm">
            <dt className="num w-32 shrink-0 text-fg">NET</dt>
            <dd className="text-fg-muted">«No Earlier Than»: no antes de esta fecha. Cuando la precisión es de día, mes o trimestre, la plataforma no muestra cuenta regresiva para no aparentar una exactitud que no existe.</dd>
          </div>
          <div className="flex items-start gap-4 px-4 py-2.5 text-sm">
            <dt className="num w-32 shrink-0 text-fg">HHI</dt>
            <dd className="text-fg-muted">Índice Herfindahl-Hirschman: suma de las cuotas al cuadrado (0–10 000). Por encima de 2 500 indica un mercado muy concentrado.</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
