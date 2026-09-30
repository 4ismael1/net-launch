"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as MLMap } from "maplibre-gl";
import { neutralizeBasemap } from "./basemap";

type Pt = { id: number; name: string; lat: number; lng: number; location_name: string | null; total: number | null; upcoming: number };

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE = KEY ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${KEY}` : "https://tiles.openfreemap.org/styles/dark";

/** Mapa mundial compacto del panel: continentes reales + plataformas; clic → mapa completo. */
export function PanelMap({ points }: { points: Pt[] }) {
  const el = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  useEffect(() => {
    let map: MLMap | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, AttributionControl, Popup, setWorkerUrl }) => {
      if (cancelled || !el.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: el.current, style: STYLE, center: [10, 22], zoom: 0.55, minZoom: 0, maxZoom: 6,
        attributionControl: false, renderWorldCopies: false, cooperativeGestures: true,
      });
      map.addControl(new AttributionControl({ compact: true }), "bottom-left");
      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "net-popup" });
      map.on("style.load", () => {
        const m = map!;
        neutralizeBasemap(m, ["p-halo", "p"]);
        m.addSource("p", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: points.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, loc: p.location_name ?? "", total: p.total ?? 0, up: p.upcoming } })),
          },
        });
        m.addLayer({ id: "p-halo", type: "circle", source: "p", filter: [">", ["get", "up"], 0], paint: { "circle-color": "#ff5b1f", "circle-opacity": 0.18, "circle-radius": ["+", 7, ["*", 1.2, ["sqrt", ["get", "up"]]]], "circle-blur": 0.5 } });
        m.addLayer({
          id: "p", type: "circle", source: "p",
          paint: {
            "circle-color": ["case", [">", ["get", "up"], 0], "#ff5b1f", "#8f8b82"],
            "circle-opacity": ["case", [">", ["get", "up"], 0], 0.95, 0.55],
            "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "total"]], 0, 2.5, 30, 7],
            "circle-stroke-width": 1, "circle-stroke-color": "#0b0b0a",
          },
        });
        m.on("mouseenter", "p", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          const pr = f.properties as { name: string; loc: string; total: number; up: number };
          popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(`<strong>${pr.name}</strong><br/><span>${pr.loc}</span><br/><span>${pr.total} lanzamientos · <b style="color:#ff5b1f">${pr.up} próximos</b></span>`)
            .addTo(m);
        });
        m.on("mouseleave", "p", () => { m.getCanvas().style.cursor = ""; popup.remove(); });
        m.on("click", "p", (e) => { const id = e.features?.[0]?.properties?.id; if (id) routerRef.current.push(`/mapa?pad=${id}`); });
      });
      // Encuadrar siempre el mundo habitado, sea cual sea el tamaño de la tarjeta
      const fit = () => map?.fitBounds([[-165, -48], [178, 68]], { padding: 8, animate: false });
      map.once("load", () => {
        fit();
        el.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
      });
      map.on("resize", fit);
    });
    return () => { cancelled = true; map?.remove(); };
  }, [points]);

  return (
    <div className="relative flex h-full min-h-[320px] flex-col">
      {/* MapLibre impone position:relative al contenedor: la altura debe venir del flujo (flex-1), no de inset-0 */}
      <div ref={el} className="min-h-[320px] w-full flex-1 bg-bg" role="img" aria-label="Mapa mundial de plataformas de lanzamiento" />
      <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-3 rounded-md border border-line bg-bg/85 px-2.5 py-1.5 text-[11px] text-fg-muted backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Con próximos</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#8f8b82]" /> Histórico</span>
      </div>
    </div>
  );
}
