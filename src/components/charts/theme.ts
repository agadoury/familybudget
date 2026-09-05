"use client";
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
export const GRID = { stroke: "var(--border)", strokeDasharray: "3 3" };
export const TOOLTIP_STYLE = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)" },
  itemStyle: { color: "var(--foreground)" },
};
/** Compact axis label: 70 000 → "70k" */
export const kFmt = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
};
