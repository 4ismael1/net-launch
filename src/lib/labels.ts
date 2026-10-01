// Diccionarios de categorías de LL2 (no nombres oficiales). Si un valor no está, se muestra el original.

const STATUS_NAME: Record<string, string> = {
  Go: "Confirmado para el lanzamiento", TBC: "Por confirmar", TBD: "Por determinar", Hold: "En espera",
  "In Flight": "En vuelo", Success: "Lanzamiento exitoso", Failure: "Lanzamiento fallido", "Partial Failure": "Fallo parcial",
  Deployed: "Carga desplegada",
};
export const statusNameEs = (abbrev?: string | null, name?: string | null) => (abbrev && STATUS_NAME[abbrev]) || name || null;

const PRECISION: Record<string, string> = {
  SEC: "Segundo", MIN: "Minuto", HR: "Hora", DAY: "Día", WK: "Semana", W: "Semana", MON: "Mes", M: "Mes",
  Q1: "Trimestre (1.º)", Q2: "Trimestre (2.º)", Q3: "Trimestre (3.º)", Q4: "Trimestre (4.º)",
  H1: "Semestre (1.º)", H2: "Semestre (2.º)", Y: "Año", YEAR: "Año", FY: "Año fiscal", DEC: "Década",
};
export const precisionEs = (p?: string | null) => (p ? PRECISION[p] ?? p : null);

const ORBIT: Record<string, string> = {
  "Low Earth Orbit": "Órbita terrestre baja",
  "Very Low Earth Orbit": "Órbita terrestre muy baja",
  "Medium Earth Orbit": "Órbita terrestre media",
  "Geostationary Orbit": "Órbita geoestacionaria",
  "Geosynchronous Orbit": "Órbita geosíncrona",
  "Geostationary Transfer Orbit": "Órbita de transferencia geoestacionaria",
  "Supersynchronous Geostationary Transfer Orbit": "Transferencia geoestacionaria supersíncrona",
  "Direct-GEO": "Inyección directa a GEO",
  "Sun-Synchronous Orbit": "Órbita heliosíncrona",
  "Polar Orbit": "Órbita polar",
  "Highly Elliptical Orbit": "Órbita muy elíptica",
  "Elliptical": "Órbita elíptica",
  "Retrograde Orbit": "Órbita retrógrada",
  "Suborbital": "Suborbital",
  "Heliocentric N/A": "Heliocéntrica",
  "Lunar Orbit": "Órbita lunar",
  "Lunar flyby": "Sobrevuelo lunar",
  "Lunar Surface": "Superficie lunar",
  "Mars Orbit": "Órbita marciana",
  "Mars Flyby": "Sobrevuelo de Marte",
  "Earth-Moon L1": "Punto L1 Tierra-Luna",
  "Earth-Moon L2": "Punto L2 Tierra-Luna",
  "Sun-Earth L1": "Punto L1 Sol-Tierra",
  "Sun-Earth L2": "Punto L2 Sol-Tierra",
  "Venus Flyby": "Sobrevuelo de Venus",
  "Unknown": "Desconocida",
};
export const orbitEs = (name?: string | null) => (name ? ORBIT[name] ?? name : null);

const MISSION_TYPE: Record<string, string> = {
  Communications: "Comunicaciones",
  "Earth Science": "Ciencias de la Tierra",
  "Government/Top Secret": "Gubernamental / clasificada",
  Navigation: "Navegación",
  "Planetary Science": "Ciencia planetaria",
  Resupply: "Reabastecimiento",
  "Robotic Exploration": "Exploración robótica",
  "Human Exploration": "Exploración tripulada",
  "Test Flight": "Vuelo de prueba",
  Tourism: "Turismo espacial",
  Astrophysics: "Astrofísica",
  Heliophysics: "Heliofísica",
  "Space Science": "Ciencia espacial",
  Technology: "Tecnología",
  "Dedicated Rideshare": "Viaje compartido (rideshare)",
  Biology: "Biología",
  "Microgravity Research": "Investigación en microgravedad",
  Unknown: "Desconocida",
};
export const missionTypeEs = (t?: string | null) => (t ? MISSION_TYPE[t] ?? t : null);
