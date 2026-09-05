"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/app/providers";
import { AXIS, CHART_COLORS, GRID, TOOLTIP_STYLE, kFmt } from "./theme";

export function BarsChart({ rows, series, height = 220, layout = "horizontal", stacked = false, xKey = "month", tick }: {
  rows: Record<string, number | string>[];
  series: { key: string; name: string; color?: string }[];
  height?: number;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
  xKey?: string;
  tick?: (v: string) => string;
}) {
  const { money } = useApp();
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={layout} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={vertical} horizontal={!vertical} />
        {/* Recharts 2 inspects direct children by type: no fragments around axes. */}
        {vertical ? <XAxis type="number" {...AXIS} tickFormatter={kFmt} /> : <XAxis dataKey={xKey} {...AXIS} tickFormatter={tick} interval={0} />}
        {vertical ? <YAxis type="category" dataKey={xKey} {...AXIS} width={120} tickFormatter={tick} /> : <YAxis {...AXIS} tickFormatter={kFmt} width={44} />}
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => money(v)} cursor={{ fill: "var(--accent)" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? "1" : undefined} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={stacked ? 0 : 3} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
