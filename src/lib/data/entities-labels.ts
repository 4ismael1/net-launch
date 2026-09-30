// Etiquetas compartibles con componentes cliente (sin dependencias de servidor).
export const AGENCY_TYPES: Record<string, string> = {
  Government: "Gubernamental",
  Commercial: "Comercial",
  Multinational: "Multinacional",
  Private: "Privada",
  Educational: "Educativa",
};
export const typeLabel = (t: string | null | undefined) => (t && AGENCY_TYPES[t]) || t || "—";
