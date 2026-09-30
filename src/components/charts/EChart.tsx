"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, LineChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent, DataZoomComponent, SVGRenderer]);

/** Tokens de gráfica (grafito cálido). Éxito gris / fallo rojo: validado para daltonismo (ΔE 9.1). */
export const CHART = {
  text: "#a6a39a",
  dim: "#716e66",
  grid: "#252521",
  surface: "#121211",
  accent: "#ff5b1f",
  success: "#9c988e",
  failure: "#ff4d4f",
  font: "var(--font-geist-mono), ui-monospace, monospace",
};

export const baseOption = {
  backgroundColor: "transparent",
  textStyle: { color: CHART.text, fontFamily: CHART.font, fontSize: 11 },
  animationDuration: 600,
  tooltip: {
    backgroundColor: "#18181699",
    borderColor: "#34332e",
    textStyle: { color: "#ecebe6", fontSize: 12 },
    extraCssText: "backdrop-filter: blur(6px); border-radius: 6px;",
  },
};

export function EChart({ option, height = 280, label }: { option: EChartsCoreOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.setOption({ ...baseOption, ...option, tooltip: { ...baseOption.tooltip, ...(option.tooltip as object) } });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [option]);
  return <div ref={el} style={{ height }} role="img" aria-label={label} className="w-full" />;
}
