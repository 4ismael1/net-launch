import type { Regime } from "@/lib/satcat";

// Regiones orbitales: rango de altitud (km sobre la superficie) usado en el dibujo y textos de apoyo
export const SHELL_NOTES: Record<Exclude<Regime, "OTRA">, { min: number; max: number; name: string; note: string }> = {
  LEO: { min: 300, max: 2000, name: "Órbita baja", note: "Estaciones, Starlink, observación de la Tierra" },
  MEO: { min: 19000, max: 23500, name: "Órbita media", note: "GPS, Galileo, GLONASS, BeiDou" },
  GEO: { min: 35586, max: 35986, name: "Geoestacionaria", note: "Comunicaciones y meteorología" },
  HEO: { min: 1000, max: 39000, name: "Muy elíptica", note: "Molniya, transferencias" },
};
