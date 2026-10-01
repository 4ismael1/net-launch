import {
  LayoutDashboard, Map, Rocket, CalendarClock, Orbit, Satellite, GraduationCap, Building2, MapPin, Layers, BarChart3, Newspaper, BookOpen,
  Moon, Telescope, Radar, Trash2, Users, Box, Image as ImageIcon, Recycle, Flag, Plane,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; group: "explorar" | "datos" | "universo" | "info" };

export const NAV: NavItem[] = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard, group: "explorar" },
  { href: "/mapa", label: "Mapa", icon: Map, group: "explorar" },
  { href: "/lanzamientos", label: "Lanzamientos", icon: Rocket, group: "explorar" },
  { href: "/eventos", label: "Eventos", icon: CalendarClock, group: "explorar" },
  { href: "/en-el-espacio", label: "En el espacio", icon: Orbit, group: "explorar" },
  { href: "/satelites", label: "Satélites", icon: Satellite, group: "explorar" },
  { href: "/trafico-aereo", label: "Tráfico aéreo", icon: Plane, group: "explorar" },
  { href: "/organizaciones", label: "Organizaciones", icon: Building2, group: "datos" },
  { href: "/bases", label: "Bases", icon: MapPin, group: "datos" },
  { href: "/vehiculos", label: "Vehículos", icon: Layers, group: "datos" },
  { href: "/programas", label: "Programas", icon: Flag, group: "datos" },
  { href: "/reutilizacion", label: "Reutilización", icon: Recycle, group: "datos" },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3, group: "datos" },
  { href: "/esta-noche", label: "Esta noche", icon: Moon, group: "universo" },
  { href: "/mas-alla", label: "Más allá de la órbita", icon: Telescope, group: "universo" },
  { href: "/asteroides", label: "Asteroides cercanos", icon: Radar, group: "universo" },
  { href: "/poblacion-orbital", label: "Población orbital", icon: Trash2, group: "universo" },
  { href: "/astronautas", label: "Astronautas", icon: Users, group: "universo" },
  { href: "/naves", label: "Naves", icon: Box, group: "universo" },
  { href: "/imagen-del-dia", label: "Imagen del día", icon: ImageIcon, group: "universo" },
  { href: "/noticias", label: "Noticias", icon: Newspaper, group: "info" },
  { href: "/metodologia", label: "Metodología", icon: BookOpen, group: "info" },
  { href: "/acerca", label: "Acerca del proyecto", icon: GraduationCap, group: "info" },
];

export const GROUPS: Record<NavItem["group"], string> = { explorar: "Explorar", datos: "Datos", universo: "Universo", info: "Información" };

export const MOBILE_MAIN = ["/panel", "/mapa", "/lanzamientos", "/estadisticas"];
