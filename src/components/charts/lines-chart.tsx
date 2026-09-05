"use client";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/app/providers";
import { AXIS, CHART_COLORS, GRID, TOOLTIP_STYLE, kFmt } from "./theme";

export interface LineSeries {
  key: string;
  name: string;
  color?: string;
  dashed?: boolean;
}

/** Generic multi-line chart over month keys. `rows` = [{ month, [key]: cents }]. */
export function LinesChart({ rows, series, height = 280, stacked = false, yearTicks = true }: { rows: Record<string, number | string | null>[]; series: LineSeries[]; height?: number; stacked?: boolean; yearTicks?: boolean }) {
  const { money } = useApp();
  const tick = (m: string) => (yearTicks ? (m.endsWith("-01") ? m.slice(0, 4) : "") : m);
  if (stacked) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="month" {...AXIS} tickFormatter={tick} interval={0} minTickGap={20} />
          <YAxis {...AXIS} tickFormatter={kFmt} width={44} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="1" stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.35} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="month" {...AXIS} tickFormatter={tick} interval={0} minTickGap={20} />
        <YAxis {...AXIS} tickFormatter={kFmt} width={44} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={s.key === "total" ? 2.5 : 1.5} strokeDasharray={s.dashed ? "6 4" : undefined} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
