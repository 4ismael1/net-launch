import { Info, Navigation } from "lucide-react";
import { getWeather, wmoLabel, windDir } from "@/lib/weather";
import { Card, CardHeader } from "@/components/ui/Card";
import { LocalTime } from "@/components/launch/LocalTime";

const f1 = (v: number | null, u: string) => (v == null ? "—" : `${v.toLocaleString("es", { maximumFractionDigits: 1 })}${u}`);

/** Clima contextual (Open-Meteo). Si el servicio falla, no se renderiza nada. */
export async function WeatherCard({ lat, lng, place, t0 }: { lat: number; lng: number; place: string; t0?: string | null }) {
  const w = await getWeather(lat, lng, t0 ?? null);
  if (!w) return null;
  const c = w.current;
  return (
    <Card>
      <CardHeader title="Clima en la plataforma" meta={place} />
      <div className="p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="num text-4xl font-medium">{f1(c.temp, "°C")}</p>
            <p className="mt-1 text-sm text-fg-muted">{wmoLabel(c.code) ?? "—"}</p>
          </div>
          <p className="text-right text-[11px] text-fg-dim">Ahora<br /><LocalTime date={c.time} mode="relative" /></p>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
          <Cell k="Viento">
            <span className="inline-flex items-center gap-1">
              {c.windDir != null && <Navigation className="size-3 text-fg-dim" style={{ transform: `rotate(${c.windDir + 180}deg)` }} aria-hidden />}
              {f1(c.wind, " km/h")}
            </span>
            {c.windDir != null && <span className="block text-[10.5px] text-fg-dim">del {windDir(c.windDir)}</span>}
          </Cell>
          <Cell k="Nubosidad">{f1(c.cloud, " %")}</Cell>
          <Cell k="Precipitación">{f1(c.precip, " mm")}</Cell>
        </dl>

        {w.atT0 && (
          <div className="mt-4 rounded-md border border-line p-3">
            <p className="label mb-2">Pronóstico a la hora prevista (T0)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
              <span><span className="text-fg-dim">Temp. </span><span className="num">{f1(w.atT0.temp, "°C")}</span></span>
              <span><span className="text-fg-dim">Viento </span><span className="num">{f1(w.atT0.wind, " km/h")}</span></span>
              <span><span className="text-fg-dim">Nubes </span><span className="num">{f1(w.atT0.cloud, " %")}</span></span>
              <span><span className="text-fg-dim">Lluvia </span><span className="num">{f1(w.atT0.precipProb, " %")}</span></span>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">{wmoLabel(w.atT0.code)}</p>
          </div>
        )}

        <p className="mt-3 flex gap-1.5 text-[11px] leading-relaxed text-fg-dim">
          <Info className="mt-0.5 size-3 shrink-0" />
          Información meteorológica contextual (Open-Meteo). No indica si el lanzamiento se realizará: esa decisión corresponde a la organización responsable.
        </p>
      </div>
    </Card>
  );
}

function Cell({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="label mb-1">{k}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}
