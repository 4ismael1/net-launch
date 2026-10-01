import { getLaunchDetail } from "@/lib/data/launch-detail";
import { isPrecise } from "@/lib/format";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");

/** Evento de calendario (.ics) con la fecha NET y la ventana del lanzamiento, respetando net_precision. */
export async function GET(req: Request, ctx: RouteContext<"/api/ics/[slug]">) {
  const { slug } = await ctx.params;
  const d = await getLaunchDetail(slug);
  if (!d?.l.net) return new Response("No encontrado", { status: 404 });
  const p = d.l.netPrecision;
  // Solo hora (SEC/MIN/HR) → evento con hora; DAY → evento de día completo (UTC); más vago (mes, trimestre, año…) → sin evento
  if (!isPrecise(p) && p !== "DAY") {
    return new Response("Este lanzamiento aún no tiene un día previsto: no se puede añadir al calendario.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  let when: string[];
  if (p === "DAY") {
    const next = new Date(d.l.net.getTime() + 864e5);
    when = [`DTSTART;VALUE=DATE:${day(d.l.net)}`, `DTEND;VALUE=DATE:${day(next)}`];
  } else {
    const start = d.l.windowStart ?? d.l.net;
    const end = d.l.windowEnd && d.l.windowEnd > start ? d.l.windowEnd : new Date(start.getTime() + 30 * 60_000);
    when = [`DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`];
  }
  const url = new URL(`/lanzamientos/${slug}`, req.url).toString();
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NET//Monitor de lanzamientos//ES", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${d.l.id}@net-launch`,
    `DTSTAMP:${fmt(new Date())}`,
    ...when,
    `SUMMARY:${esc(`🚀 ${d.l.name}`)}`,
    `LOCATION:${esc([d.pad?.name, d.location?.name].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`Estado: ${d.l.statusName ?? "—"}. ${p === "DAY" ? "Día previsto (sin hora confirmada). " : ""}La fecha puede cambiar; consulta ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.ics"` },
  });
}
