"use client";

import { useMemo } from "react";
import { EChart, CHART } from "./EChart";
import { OBJ_LABEL, OBJ_TYPES, TYPE_COLORS, type ObjType } from "@/lib/satcat";

const axis = {
  axisLine: { lineStyle: { color: CHART.grid } },
  axisTick: { show: false },
  axisLabel: { color: CHART.dim, fontSize: 10.5, fontFamily: CHART.font },
  splitLine: { lineStyle: { color: CHART.grid, type: "dashed" as const } },
};
const nf = new Intl.NumberFormat("es");

type T = ObjType;
const ORDER = OBJ_TYPES;
const TYPE_LABEL = OBJ_LABEL;

/** Objetos catalogados en órbita terrestre a fin de cada año, apilados por tipo. */
export function PopulationChart({ years }: { years: ({ y: number } & Record<T, number>)[] }) {
  const option = useMemo(() => ({
    grid: { left: 48, right: 12, top: 34, bottom: 24 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: CHART.text }, data: ORDER.map((t) => TYPE_LABEL[t]) },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "#ecebe655" } },
      formatter: (p: { axisValue: string; value: number; seriesName: string; color: string }[]) => {
        const total = p.reduce((s, x) => s + (x.value ?? 0), 0);
        return `<b>${p[0].axisValue}</b> · ${nf.format(total)} objetos<br/>` + [...p].reverse().map((x) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${x.color};margin-right:6px"></span>${x.seriesName}: ${nf.format(x.value)}`).join("<br/>");
      },
    },
    xAxis: { type: "category", boundaryGap: false, data: years.map((d) => d.y), ...axis, splitLine: { show: false } },
    yAxis: { type: "value", ...axis, axisLine: { show: false }, axisLabel: { ...axis.axisLabel, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)) } },
    series: ORDER.map((t) => ({
      name: TYPE_LABEL[t], type: "line", stack: "pop", symbol: "none", smooth: 0.2,
      lineStyle: { width: 1.5, color: TYPE_COLORS[t] }, itemStyle: { color: TYPE_COLORS[t] },
      areaStyle: { color: TYPE_COLORS[t], opacity: 0.22 },
      emphasis: { focus: "series" },
      data: years.map((d) => d[t]),
    })),
  }), [years]);
  return <EChart option={option} height={300} label="Población de objetos en órbita terrestre por año y tipo" />;
}
