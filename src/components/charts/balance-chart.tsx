"use client";
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/app/providers";
import { AXIS, CHART_COLORS, GRID, TOOLTIP_STYLE, kFmt } from "./theme";

export interface Series {
  key: string;
  name: string;
  points: { month: string; cents: number }[];
  dashed?: boolean;
  dotted?: boolean;
  color?: string;
}

export function BalanceChart({ series, actuals, height = 280 }: { series: Series[]; actuals?: { month: string; cents: number }[]; height?: number }) {
  const { money } = useApp();
  const months = new Set<string>();
  for (const s of series) for (const p of s.points) months.add(p.month);
  for (const a of actuals ?? []) months.add(a.month);
  const sorted = [...months].sort();
  const data = sorted.map((m) => {
    const row: Record<string, number | string | null> = { month: m };
    for (const s of series) row[s.key] = s.points.find((p) => p.month === m)?.cents ?? null;
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => (m.endsWith("-01") ? m.slice(0, 4) : "")} interval={0} minTickGap={20} />
        <YAxis {...AXIS} tickFormatter={kFmt} width={44} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={s.dashed || s.dotted ? 1.5 : 2}
            strokeDasharray={s.dotted ? "2 4" : s.dashed ? "6 4" : undefined}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
        {(actuals ?? []).map((a) => (
          <ReferenceDot key={a.month} x={a.month} y={a.cents} r={4} fill="var(--foreground)" stroke="var(--card)" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
