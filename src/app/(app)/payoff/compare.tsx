"use client";
import * as React from "react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BalanceChart, type Series } from "@/components/charts/balance-chart";
import { buildProjection } from "@/lib/projection";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import type { HouseholdDTO, ScenarioDTO } from "@/lib/dto-household";
import { asHousehold, useStartMonth } from "./use-projection";
import { CHART_COLORS } from "@/components/charts/theme";

export function Compare({ data, scenarios, current }: { data: HouseholdDTO; scenarios: ScenarioDTO[]; current: { name: string; overrides: ScenarioOverrides } }) {
  const { t, money, month, lang } = useApp();
  const startMonth = useStartMonth();
  const options = React.useMemo(
    () => [{ id: "__current", name: `${current.name} (${lang === "fr" ? "en cours" : "working copy"})`, overrides: current.overrides, isBaseline: false }, ...scenarios],
    [scenarios, current, lang],
  );
  const baselineId = scenarios.find((s) => s.isBaseline)?.id ?? "";
  const [picked, setPicked] = React.useState<string[]>(() => [baselineId, "__current", ...scenarios.filter((s) => !s.isBaseline).slice(0, 2).map((s) => s.id)].filter(Boolean).slice(0, 4));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));

  const rows = React.useMemo(() => {
    const base = buildProjection(asHousehold(data), { startMonth, overrides: scenarios.find((s) => s.isBaseline)?.overrides ?? EMPTY_OVERRIDES });
    return picked
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => {
        const p = buildProjection(asHousehold(data), { startMonth, overrides: o.overrides });
        const payoffIdx = p.payoff.outcome.kind === "paid" ? p.payoff.months.length - 1 : null;
        const nwAtPayoff = payoffIdx !== null ? p.netWorth[Math.min(payoffIdx, p.netWorth.length - 1)]?.cents ?? null : null;
        const monthly = p.payoff.scheduledMonth0Cents + (o.overrides.extraMonthly?.cents ?? 0) + p.budget.debtPaydownIncomeCents;
        return { o, p, nwAtPayoff, monthly, saved: base.payoff.consumerInterestCents - p.payoff.consumerInterestCents };
      });
  }, [picked, options, data, startMonth, scenarios]);

  const series: Series[] = rows.map((r, i) => ({ key: r.o.id, name: r.o.name, points: r.p.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), color: CHART_COLORS[i % CHART_COLORS.length], dashed: r.o.isBaseline }));

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-1">
              <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} disabled={!picked.includes(o.id) && picked.length >= 4} /> {o.name}
            </label>
          ))}
          <span className="text-xs text-muted-foreground self-center">({lang === "fr" ? "2 à 4" : "pick 2–4"})</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("payoff.scenario")}</TableHead>
              <TableHead>{t("dash.debtFree")}</TableHead>
              <TableHead className="text-right">{t("common.months")}</TableHead>
              <TableHead className="text-right">{t("payoff.totalInterest")}</TableHead>
              <TableHead className="text-right">{t("payoff.interestSaved")}</TableHead>
              <TableHead className="text-right">{lang === "fr" ? "Paiement mensuel requis" : "Monthly payment required"}</TableHead>
              <TableHead className="text-right">{lang === "fr" ? "Valeur nette au remboursement" : "Net worth at payoff"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.o.id}>
                <TableCell className="font-medium">{r.o.name}</TableCell>
                <TableCell>{r.p.payoff.outcome.kind === "paid" ? month(r.p.payoff.outcome.month) : t("common.never")}</TableCell>
                <TableCell className="text-right tabular">{r.p.payoff.outcome.kind === "paid" ? r.p.payoff.outcome.months : "—"}</TableCell>
                <TableCell className="text-right tabular">{money(r.p.payoff.consumerInterestCents, { compact: true })}</TableCell>
                <TableCell className={`text-right tabular ${r.saved > 0 ? "text-good" : r.saved < 0 ? "text-act" : ""}`}>{money(r.saved, { compact: true, sign: true })}</TableCell>
                <TableCell className="text-right tabular">{money(r.monthly, { compact: true })}</TableCell>
                <TableCell className="text-right tabular">{r.nwAtPayoff !== null ? money(r.nwAtPayoff, { compact: true }) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">{lang === "fr" ? "Paiement mensuel requis = minimums du mois courant + supplément + allocation de garde. Valeur nette = placements inclus − dettes (hypothèque exclue)." : "Monthly payment required = current scheduled minimums + extra + child-care payment. Net worth = included investments − debts (mortgage excluded)."}</p>
        <BalanceChart series={series} height={260} />
      </CardContent>
    </Card>
  );
}
