"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { neutralizeBasemap, MAP_LOCALE } from "./basemap";

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE = KEY ? `https://api.maptiler.com/maps/hybrid/style.json?key=${KEY}` : "https://tiles.openfreemap.org/styles/dark";

/** Minimapa de la ubicación exacta de la plataforma (vista satélite si hay clave de MapTiler). */
export function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map, Marker, NavigationControl, AttributionControl, setWorkerUrl }) => {
      if (cancelled || !el.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: el.current, locale: MAP_LOCALE,
        style: STYLE,
        center: [lng, lat],
        zoom: KEY ? 14 : 9,
        attributionControl: false,
        cooperativeGestures: false,
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");
      const dot = document.createElement("div");
      dot.className = "size-4 rounded-full border-2 border-white bg-accent shadow-[0_0_0_6px_rgba(255,91,31,.25)]";
      dot.title = label;
      new Marker({ element: dot }).setLngLat([lng, lat]).addTo(map);
      if (!KEY) map.on("style.load", () => neutralizeBasemap(map!));
      map.once("load", () => el.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, label]);
  return <div ref={el} className="h-64 w-full bg-bg" aria-label={`Mapa de ${label}`} role="img" />;
}
