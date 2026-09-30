import {
  LayoutDashboard, Map, Rocket, CalendarClock, Orbit, Satellite, GraduationCap, Building2, MapPin, Layers, BarChart3, Newspaper, BookOpen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; group: "explorar" | "datos" | "info" };

export const NAV: NavItem[] = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard, group: "explorar" },
  { href: "/mapa", label: "Mapa", icon: Map, group: "explorar" },
  { href: "/lanzamientos", label: "Lanzamientos", icon: Rocket, group: "explorar" },
  { href: "/eventos", label: "Eventos", icon: CalendarClock, group: "explorar" },
  { href: "/en-el-espacio", label: "En el espacio", icon: Orbit, group: "explorar" },
  { href: "/satelites", label: "Satélites", icon: Satellite, group: "explorar" },
  { href: "/organizaciones", label: "Organizaciones", icon: Building2, group: "datos" },
  { href: "/bases", label: "Bases", icon: MapPin, group: "datos" },
  { href: "/vehiculos", label: "Vehículos", icon: Layers, group: "datos" },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3, group: "datos" },
  { href: "/noticias", label: "Noticias", icon: Newspaper, group: "info" },
  { href: "/metodologia", label: "Metodología", icon: BookOpen, group: "info" },
  { href: "/acerca", label: "Acerca del proyecto", icon: GraduationCap, group: "info" },
];

export const GROUPS: Record<NavItem["group"], string> = { explorar: "Explorar", datos: "Datos", info: "Información" };

export const MOBILE_MAIN = ["/panel", "/mapa", "/lanzamientos", "/estadisticas"];
