import type { Map as MLMap } from "maplibre-gl";

/** Paleta del mapa base: grafito cálido, igual que la interfaz (evita el azul típico de los estilos oscuros). */
export const MAP_COLORS = {
  bg: "#0b0b0a",
  water: "#0e0e0d",
  land: "#141412",
  landAlt: "#171715",
  line: "#2c2b27",
  lineMajor: "#3a3934",
  boundary: "#4a4842",
  text: "#8f8b82",
  textHalo: "#0b0b0a",
};

/** Recolorea un estilo vectorial oscuro (OpenFreeMap/MapTiler) sin tocar las capas de datos propias. */
export function neutralizeBasemap(map: MLMap, own: string[] = []) {
  const C = MAP_COLORS;
  for (const l of map.getStyle().layers ?? []) {
    if (own.includes(l.id)) continue;
    const id = l.id.toLowerCase();
    try {
      if (l.type === "raster") {
        // Relieve sombreado: sin color, muy tenue
        map.setPaintProperty(l.id, "raster-saturation", -1);
        map.setPaintProperty(l.id, "raster-brightness-max", 0.3);
      } else if (l.type === "background") map.setPaintProperty(l.id, "background-color", C.bg);
      else if (l.type === "fill") map.setPaintProperty(l.id, "fill-color", /water|ocean|lake|river/.test(id) ? C.water : /park|wood|grass|landcover|landuse/.test(id) ? C.landAlt : C.land);
      else if (l.type === "line") map.setPaintProperty(l.id, "line-color", /water|river/.test(id) ? C.water : /boundary|admin/.test(id) ? C.boundary : /motorway|trunk|primary/.test(id) ? C.lineMajor : C.line);
      else if (l.type === "symbol" && map.getLayoutProperty(l.id, "text-field") !== undefined) {
        map.setPaintProperty(l.id, "text-color", C.text);
        map.setPaintProperty(l.id, "text-halo-color", C.textHalo);
      } else if (l.type === "fill-extrusion") map.setPaintProperty(l.id, "fill-extrusion-color", C.landAlt);
    } catch {
      /* capa sin esa propiedad: se ignora */
    }
  }
}

/** Textos de MapLibre en español. */
export const MAP_LOCALE = {
  "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda del ratón para hacer zoom",
  "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + rueda del ratón para hacer zoom",
  "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "AttributionControl.ToggleAttribution": "Mostrar atribución",
};
