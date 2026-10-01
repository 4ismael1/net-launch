"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import type { GeoJSONSource, Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import { Globe2, Layers, Satellite, X, ArrowUpRight, Crosshair } from "lucide-react";
import type { MapOperator, MapPad } from "@/lib/data/map";
import { countryName } from "@/lib/format";
import { Flag } from "@/components/ui/Flag";
import { StatusBadge } from "@/components/launch/StatusBadge";
import { LocalTime } from "@/components/launch/LocalTime";
import { Countdown } from "@/components/launch/Countdown";
import { neutralizeBasemap, MAP_LOCALE } from "./basemap";

type View = "all" | "upcoming" | "recent";
type Activity = { slug: string; name: string; net: string | null; net_precision: string | null; status_abbrev: string | null; provider: string | null; rocket: string | null; kind: "upcoming" | "recent" };

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLES = {
  dark: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
    : "https://tiles.openfreemap.org/styles/dark",
  satellite: MAPTILER_KEY ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}` : null,
};

const VIEWS: View[] = ["all", "upcoming", "recent"];
const asView = (v: string | null): View => (VIEWS.includes(v as View) ? (v as View) : "all");

const C = { accent: "#ff5b1f", recent: "#a6a39a", old: "#4d4a44", bg: "#0b0b0a", cluster: "#5e5b54" };

function toGeoJSON(pads: MapPad[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pads.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, upcoming: p.upcoming, recent: p.recent, total: p.total, loc: p.locationName ?? "" },
    })),
  };
}

function qs(view: string, country: string, operator: string, selected: number | null) {
  const q = new URLSearchParams();
  if (view !== "all") q.set("vista", view);
  if (country) q.set("pais", country);
  if (operator) q.set("op", operator);
  if (selected) q.set("pad", String(selected));
  return q.toString();
}

export function WorldMap({ pads, operators }: { pads: MapPad[]; operators: MapOperator[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const router = useRouter();
  const params = useSearchParams();

  const [view, setView] = useState<View>(asView(params.get("vista")));
  const [country, setCountry] = useState(params.get("pais") ?? "");
  const [operator, setOperator] = useState(params.get("op") ?? "");
  const [globe, setGlobe] = useState(false);
  const [base, setBase] = useState<"dark" | "satellite">("dark");
  const [selected, setSelected] = useState<number | null>(params.get("pad") ? Number(params.get("pad")) : null);
  const [activity, setActivity] = useState<{ id: number; rows: Activity[] | null } | null>(null); // rows null = error
  const [styleVersion, setStyleVersion] = useState(0); // sube cada vez que (re)carga un estilo
  const baseRef = useRef(base);
  baseRef.current = base;

  const filtered = useMemo(
    () =>
      pads.filter(
        (p) =>
          (view === "all" || (view === "upcoming" ? p.upcoming > 0 : p.recent > 0)) &&
          (!country || p.country === country) &&
          (!operator || p.providers.includes(Number(operator))),
      ),
    [pads, view, country, operator],
  );
  const countries = useMemo(
    () => [...new Set(pads.map((p) => p.country).filter(Boolean) as string[])].sort((a, b) => (countryName(a) ?? a).localeCompare(countryName(b) ?? b, "es")),
    [pads],
  );
  const pad = selected ? pads.find((p) => p.id === selected) ?? null : null;
  const act = activity?.id === selected ? activity : null;
  const rows = act?.rows ?? null;
  const actError = !!act && act.rows === null;
  const padRef = useRef(pad);
  padRef.current = pad;

  // URL → estado: enlaces "Ver en el mapa", atrás/adelante y la página conservada por Next al volver.
  // Se ajusta durante el render (antes de los efectos), así el efecto de abajo nunca pisa la URL nueva.
  const urlKey = params.toString();
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (urlKey !== seenUrl) {
    const p = new URLSearchParams(urlKey);
    setSeenUrl(urlKey);
    setView(asView(p.get("vista")));
    setCountry(p.get("pais") ?? "");
    setOperator(p.get("op") ?? "");
    setSelected(p.get("pad") ? Number(p.get("pad")) : null);
  }

  // Estado → URL (compartible)
  useEffect(() => {
    const s = qs(view, country, operator, selected);
    if (s === new URLSearchParams(window.location.search).toString()) return;
    router.replace(`/mapa${s ? `?${s}` : ""}`, { scroll: false });
  }, [view, country, operator, selected, router]);

  // Crear el mapa (una vez)
  useEffect(() => {
    let map: MLMap | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, NavigationControl, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !el.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: el.current, locale: MAP_LOCALE,
        // Al volver a la página (Activity) se recrea con el mapa base elegido, no siempre el oscuro
        style: (baseRef.current === "satellite" && STYLES.satellite) || STYLES.dark,
        center: padRef.current ? [padRef.current.lng, padRef.current.lat] : [0, 20],
        zoom: padRef.current ? 9 : 1.4,
        minZoom: 0.8,
        attributionControl: false,
        renderWorldCopies: false,
      });
      map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true, customAttribution: "Datos de lanzamientos: The Space Devs" }), "bottom-left");
      map.on("style.load", () => setupLayers(map!));
      // Interacción con las capas propias: una sola vez (sobreviven a setStyle; registrarlas en cada carga las duplicaría)
      const m = map;
      m.on("click", "clusters", async (e) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (!f) return;
        const zoom = await (m.getSource("pads") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      m.on("click", "pads", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) setSelected(Number(id));
      });
      for (const l of ["clusters", "pads"]) {
        m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", l, () => (m.getCanvas().style.cursor = ""));
      }
      // Atribución plegada por defecto (sigue accesible con el botón "i")
      map.once("load", () => el.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se crea una sola vez
  }, []);

  function setupLayers(map: MLMap) {
    // Integrar el estilo base con la paleta de la app
    if (baseRef.current === "dark") neutralizeBasemap(map, ["clusters", "cluster-count", "pad-halo", "pads"]);
    if (!map.getSource("pads")) {
      map.addSource("pads", {
        type: "geojson",
        data: toGeoJSON([]),
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 7,
        clusterProperties: { upcoming: ["+", ["get", "upcoming"]] },
      });
    }
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "pads",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["case", [">", ["get", "upcoming"], 0], C.accent, C.cluster],
        "circle-opacity": 0.85,
        "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 24],
        "circle-stroke-width": 6,
        "circle-stroke-color": ["case", [">", ["get", "upcoming"], 0], "rgba(255,91,31,.22)", "rgba(94,91,84,.3)"],
      },
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "pads",
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold", "Open Sans Bold"] },
      paint: { "text-color": "#fff" },
    });
    map.addLayer({
      id: "pad-halo",
      type: "circle",
      source: "pads",
      filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "upcoming"], 0]],
      paint: { "circle-color": C.accent, "circle-opacity": 0.18, "circle-radius": ["+", 9, ["*", 2, ["sqrt", ["get", "total"]]] ], "circle-blur": 0.4 },
    });
    map.addLayer({
      id: "pads",
      type: "circle",
      source: "pads",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", [">", ["get", "upcoming"], 0], C.accent, [">", ["get", "recent"], 0], C.recent, C.old],
        "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "total"]], 0, 4, 30, 11],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 1],
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "selected"], false], "#ffffff", C.bg],
      },
    });

    syncData(map);
    setStyleVersion((v) => v + 1);
  }

  function syncData(map: MLMap) {
    const src = map.getSource("pads") as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(filteredRef.current));
  }
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
    if (mapRef.current?.isStyleLoaded()) syncData(mapRef.current);
  }, [filtered, styleVersion]);

  // Proyección globo / mercator
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => map.setProjection({ type: globe ? "globe" : "mercator" });
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [globe, styleVersion]);

  // Cambio de mapa base
  useEffect(() => {
    const map = mapRef.current;
    const url = base === "satellite" ? STYLES.satellite : STYLES.dark;
    if (!map || !url) return;
    map.setStyle(url);
  }, [base]);

  // Selección: estado visual, vuelo y carga de actividad
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ready = () => map.isStyleLoaded() && !!map.getSource("pads");
    if (!pad) {
      // Al cerrar la ficha se quita el anillo de selección
      if (ready()) map.removeFeatureState({ source: "pads" });
      return;
    }
    const go = () => {
      map.removeFeatureState({ source: "pads" });
      map.setFeatureState({ source: "pads", id: pad.id }, { selected: true });
      map.flyTo({ center: [pad.lng, pad.lat], zoom: Math.max(map.getZoom(), base === "satellite" ? 14 : 10), speed: 1.4 });
    };
    if (ready()) { go(); return; }
    map.once("idle", go);
    return () => { map.off("idle", go); }; // una selección nueva antes de estar listo no vuela a la anterior
    // styleVersion: el mapa se crea de forma asíncrona; al estar listo se vuela a la plataforma pedida
  }, [pad, base, styleVersion]);

  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    fetch(`/api/pads/${selected}`, { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((rows: Activity[]) => setActivity({ id: selected, rows: Array.isArray(rows) ? rows : null }))
      .catch(() => { if (!ctrl.signal.aborted) setActivity({ id: selected, rows: null }); });
    return () => ctrl.abort();
  }, [selected]);

  const topPads = useMemo(() => [...filtered].sort((a, b) => b.upcoming - a.upcoming || b.recent - a.recent).slice(0, 8), [filtered]);

  return (
    <div className="relative flex h-[calc(100dvh-56px-4rem-env(safe-area-inset-bottom))] flex-col overflow-hidden md:h-[calc(100dvh-56px)] md:flex-row">
      <div ref={el} className="relative min-h-0 flex-1 bg-bg" />

      {/* Controles flotantes */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 flex flex-wrap items-start gap-2 md:right-[calc(360px+12px)]">
        <div className="pointer-events-auto flex rounded-md border border-line bg-bg/90 p-0.5 text-xs backdrop-blur">
          {([["all", "Todas"], ["upcoming", "Con próximos"], ["recent", "Activas 12 m"]] as [View, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={clsx("rounded px-2.5 py-1.5", view === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
              {l}
            </button>
          ))}
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="pointer-events-auto h-8 max-w-40 rounded-md border border-line bg-bg/90 px-2 text-xs text-fg backdrop-blur" aria-label="País">
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
        </select>
        <select value={operator} onChange={(e) => setOperator(e.target.value)} className="pointer-events-auto h-8 max-w-44 rounded-md border border-line bg-bg/90 px-2 text-xs text-fg backdrop-blur" aria-label="Operador">
          <option value="">Todos los operadores</option>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="pointer-events-auto ml-auto flex gap-1">
          <IconBtn active={globe} onClick={() => setGlobe(!globe)} label="Vista de globo"><Globe2 className="size-4" /></IconBtn>
          <IconBtn active={base === "satellite"} disabled={!STYLES.satellite} onClick={() => setBase(base === "dark" ? "satellite" : "dark")} label={STYLES.satellite ? "Vista satélite" : "Vista satélite (requiere clave de MapTiler)"}>
            {base === "satellite" ? <Layers className="size-4" /> : <Satellite className="size-4" />}
          </IconBtn>
        </div>
      </div>

      {/* Panel lateral / hoja inferior */}
      <aside className="max-h-[45%] shrink-0 overflow-y-auto overscroll-contain border-t border-line bg-surface md:max-h-none md:w-[360px] md:border-t-0 md:border-l">
        {pad ? (
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <p className="label mb-1">Plataforma</p>
                <h2 className="font-semibold leading-snug">{pad.name}</h2>
                <p className="mt-1 text-sm text-fg-muted">{pad.locationName}</p>
                <p className="mt-1 text-xs text-fg-dim"><Flag code={pad.country} /> {countryName(pad.country) ?? "—"} · <span className="num">{pad.lat.toFixed(4)}°, {pad.lng.toFixed(4)}°</span></p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-fg-dim hover:bg-surface-3 hover:text-fg" aria-label="Cerrar"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
              <Stat k="Próximos" v={pad.upcoming} accent />
              <Stat k="12 meses" v={pad.recent} />
              <Stat k="Total" v={pad.total} />
            </div>
            {pad.nextSlug && (
              <div className="border-b border-line p-4">
                <p className="label mb-2">Siguiente desde aquí</p>
                <Link href={`/lanzamientos/${pad.nextSlug}`} className="group block">
                  <p className="text-sm group-hover:underline">{pad.nextName}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge abbrev={pad.nextStatus} />
                    <Countdown net={pad.nextNet} precision={pad.nextPrecision} size="sm" status={pad.nextStatus} />
                  </div>
                </Link>
              </div>
            )}
            {actError ? (
              <p className="border-b border-line px-4 py-4 text-xs text-fg-dim">No se pudo cargar la actividad de esta plataforma. Inténtalo más tarde.</p>
            ) : (
              <>
                <ActivityList title="Próximos" rows={rows?.filter((r) => r.kind === "upcoming")} empty="Sin lanzamientos programados." />
                <ActivityList title="Recientes" rows={rows?.filter((r) => r.kind === "recent")} empty="Sin resultados registrados." />
              </>
            )}
            <div className="p-4">
              {pad.locationId && (
                <Link href={`/bases/${pad.locationId}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Ver la base completa <ArrowUpRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="border-b border-line p-4">
              <p className="label mb-1">Actividad mundial</p>
              <p className="text-sm text-fg-muted">
                <span className="num text-fg">{filtered.length}</span> plataformas ·{" "}
                <span className="num text-accent">{filtered.filter((p) => p.upcoming > 0).length}</span> con lanzamientos programados
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-fg-muted">
                <Legend color={C.accent} label="Con próximos" />
                <Legend color={C.recent} label="Activa (12 meses)" />
                <Legend color={C.old} label="Solo histórico" />
              </div>
            </div>
            <p className="label px-4 pt-4 pb-2">Más activas ahora</p>
            <ul>
              {topPads.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelected(p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                    <Crosshair className={clsx("size-4 shrink-0", p.upcoming ? "text-accent" : "text-fg-dim")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{p.name}</span>
                      <span className="block truncate text-xs text-fg-dim"><Flag code={p.country} /> {p.locationName}</span>
                    </span>
                    <span className="num text-xs text-fg-muted">{p.upcoming}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function IconBtn({ children, active, onClick, label, disabled }: { children: React.ReactNode; active?: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active}
      className={clsx("flex size-8 items-center justify-center rounded-md border backdrop-blur transition-colors disabled:opacity-40",
        active ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-bg/90 text-fg-muted hover:text-fg")}>
      {children}
    </button>
  );
}

function Stat({ k, v, accent }: { k: string; v: number; accent?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="label">{k}</p>
      <p className={clsx("num mt-1 text-xl", accent && v > 0 ? "text-accent" : "text-fg")}>{v}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: color }} />{label}</span>;
}

function ActivityList({ title, rows, empty }: { title: string; rows: Activity[] | undefined; empty: string }) {
  return (
    <div className="border-b border-line">
      <p className="label px-4 pt-4 pb-2">{title}</p>
      {!rows ? (
        <p className="px-4 pb-4 text-xs text-fg-dim">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-fg-dim">{empty}</p>
      ) : (
        <ul className="pb-2">
          {rows.map((r) => (
            <li key={r.slug}>
              <Link href={`/lanzamientos/${r.slug}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{r.name}</span>
                  <LocalTime date={r.net} precision={r.net_precision} className="num text-[11px] text-fg-dim" />
                </span>
                <StatusBadge abbrev={r.status_abbrev} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
