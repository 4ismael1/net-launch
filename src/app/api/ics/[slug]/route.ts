import { getLaunchDetail } from "@/lib/data/launch-detail";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Evento de calendario (.ics) con la fecha NET y la ventana del lanzamiento. */
export async function GET(req: Request, ctx: RouteContext<"/api/ics/[slug]">) {
  const { slug } = await ctx.params;
  const d = await getLaunchDetail(slug);
  if (!d?.l.net) return new Response("No encontrado", { status: 404 });
  const start = d.l.windowStart ?? d.l.net;
  const end = d.l.windowEnd && d.l.windowEnd > start ? d.l.windowEnd : new Date(start.getTime() + 30 * 60_000);
  const url = new URL(`/lanzamientos/${slug}`, req.url).toString();
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NET//Monitor de lanzamientos//ES", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${d.l.id}@net-launch`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`🚀 ${d.l.name}`)}`,
    `LOCATION:${esc([d.pad?.name, d.location?.name].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`Estado: ${d.l.statusName ?? "—"}. La fecha puede cambiar; consulta ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.ics"` },
  });
}
