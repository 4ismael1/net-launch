"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as echarts from "echarts/core";
import { EChart, CHART, baseOption } from "./EChart";

const axis = {
  axisLine: { lineStyle: { color: CHART.grid } },
  axisTick: { show: false },
  axisLabel: { color: CHART.dim, fontSize: 10.5 },
  splitLine: { lineStyle: { color: CHART.grid, type: "dashed" as const } },
};
const nf = new Intl.NumberFormat("es");

/** Lanzamientos por año: éxitos + fallos apilados, con zoom temporal. */
export function YearsChart({ data }: { data: { year: number; success: number; failure: number }[] }) {
  const option = useMemo(() => ({
    grid: { left: 36, right: 12, top: 28, bottom: data.length > 25 ? 52 : 24 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: CHART.text }, data: ["Éxitos", "Fallos"] },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "#ffffff08" } },
      formatter: (p: { axisValue: string; value: number; seriesName: string }[]) => {
        const s = p[0]?.value ?? 0, f = p[1]?.value ?? 0, t = s + f;
        return `<b>${p[0].axisValue}</b><br/>${nf.format(t)} lanzamientos<br/>Éxitos: ${nf.format(s)}<br/>Fallos: ${nf.format(f)}${t ? `<br/>Éxito: ${(Math.round((s / t) * 1000) / 10).toLocaleString("es")} %` : ""}`;
      },
    },
    xAxis: { type: "category", data: data.map((d) => d.year), ...axis, splitLine: { show: false } },
    yAxis: { type: "value", ...axis, axisLine: { show: false } },
    dataZoom: data.length > 25 ? [{ type: "slider", height: 18, bottom: 6, borderColor: CHART.grid, backgroundColor: "transparent", fillerColor: "#ff5b1f22", handleStyle: { color: CHART.accent }, textStyle: { color: CHART.dim }, start: Math.max(0, 100 - (30 / data.length) * 100), end: 100 }, { type: "inside" }] : undefined,
    series: [
      { name: "Éxitos", type: "bar", stack: "t", data: data.map((d) => d.success), itemStyle: { color: CHART.success }, barMaxWidth: 22 },
      { name: "Fallos", type: "bar", stack: "t", data: data.map((d) => d.failure), itemStyle: { color: CHART.failure, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 22 },
    ],
  }), [data]);
  return <EChart option={option} height={300} label="Lanzamientos completados por año, éxitos y fallos" />;
}

/** Barras horizontales de un solo color (magnitud). Clic → página de detalle. */
export function HBar({ rows, hrefBase, label, color = CHART.accent }: { rows: { id?: number | string; name: string; n: number }[]; hrefBase?: string; label: string; color?: string }) {
  const router = useRouter();
  const short = (t: string) => (t.length > 26 ? `${t.slice(0, 25).trimEnd()}…` : t);
  const top = rows.slice(0, 12).reverse();
  const option = useMemo(() => ({
    grid: { left: 8, right: 44, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: "item", formatter: (p: { dataIndex: number; value: number }) => `${top[p.dataIndex].name}: <b>${nf.format(p.value)}</b>` },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", data: top.map((r) => short(r.name)), ...axis, axisLine: { show: false }, axisLabel: { color: CHART.text, fontSize: 11 } },
    series: [{
      type: "bar", data: top.map((r) => r.n), barMaxWidth: 14, itemStyle: { color, borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: "right", color: CHART.text, fontSize: 10.5, fontFamily: CHART.font },
      cursor: hrefBase ? "pointer" : "default",
    }],
  }), [top, color, hrefBase]);
  const height = Math.max(120, top.length * 26 + 16);
  return (
    <EChartClickable option={option} height={height} label={label} onClick={(i) => { const r = top[i]; if (hrefBase && r?.id != null) router.push(`${hrefBase}${r.id}`); }} />
  );
}

function EChartClickable({ option, height, label, onClick }: { option: object; height: number; label: string; onClick: (i: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onClick);
  useEffect(() => { cb.current = onClick; });
  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.setOption({ ...baseOption, ...option, tooltip: { ...baseOption.tooltip, ...((option as { tooltip?: object }).tooltip ?? {}) } });
    chart.on("click", (p) => cb.current(p.dataIndex));
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [option]);
  return <div ref={el} style={{ height }} role="img" aria-label={label} className="w-full" />;
}

/** Actividad mensual: realizados (24 meses) + programados con fecha confirmada. */
export function MonthlyChart({ data }: { data: { month: string; done: number; planned: number }[] }) {
  const fmt = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" });
  const option = useMemo(() => ({
    grid: { left: 32, right: 8, top: 28, bottom: 24 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: CHART.text }, data: ["Realizados", "Programados (GO/TBC)"] },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "#ffffff08" } } },
    xAxis: { type: "category", data: data.map((d) => fmt(d.month)), ...axis, splitLine: { show: false }, axisLabel: { ...axis.axisLabel, interval: 2 } },
    yAxis: { type: "value", ...axis, axisLine: { show: false } },
    series: [
      { name: "Realizados", type: "bar", stack: "m", data: data.map((d) => d.done), itemStyle: { color: CHART.success }, barMaxWidth: 16 },
      { name: "Programados (GO/TBC)", type: "bar", stack: "m", data: data.map((d) => d.planned), itemStyle: { color: CHART.accent, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 16 },
    ],
  }), [data]);
  return <EChart option={option} height={260} label="Lanzamientos por mes" />;
}

/** Calendario del año en curso (un solo tono, de oscuro a intenso). */
export function CalendarChart({ data, year }: { data: { day: string; n: number }[]; year: number }) {
  const option = useMemo(() => ({
    tooltip: { formatter: (p: { value: [string, number] }) => `${new Date(p.value[0] + "T00:00:00Z").toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" })}: <b>${p.value[1]}</b> lanzamiento${p.value[1] === 1 ? "" : "s"}` },
    visualMap: { show: false, min: 0, max: Math.max(3, ...data.map((d) => d.n)), inRange: { color: ["#2a2521", "#7a3a1c", "#c24a17", "#ff5b1f", "#ffb08c"] } },
    calendar: {
      range: String(year), top: 22, left: 28, right: 8, bottom: 4, cellSize: ["auto", 13],
      itemStyle: { color: "#161614", borderColor: CHART.surface, borderWidth: 2 },
      splitLine: { show: false },
      dayLabel: { firstDay: 1, nameMap: ["D", "L", "M", "X", "J", "V", "S"], color: CHART.dim, fontSize: 9 },
      monthLabel: { nameMap: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], color: CHART.dim, fontSize: 10 },
      yearLabel: { show: false },
    },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: data.map((d) => [d.day, d.n]) }],
  }), [data, year]);
  return <EChart option={option} height={140} label={`Lanzamientos por día en ${year}`} />;
}
