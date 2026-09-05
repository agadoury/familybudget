"use client";
import * as React from "react";
import Link from "next/link";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BarsChart } from "@/components/charts/bars-chart";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import { monthDiff, monthKey } from "@/lib/frequency";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";
import { generateInsights } from "@/lib/insights/rules";
import { useProjection } from "./payoff/use-projection";

export function Dashboard({ data, activeScenario, baselineOverrides, snapshots }: { data: HouseholdDTO; activeScenario: { id: string; name: string; overrides: ScenarioOverrides } | null; baselineOverrides: ScenarioOverrides | null; snapshots: SnapshotDTO[] }) {
  const { t, money, month, lang, pct, personName } = useApp();
  const [includeHome, setIncludeHome] = React.useState(data.settings.includeHomeEquity);
  const active = useProjection(data, activeScenario?.overrides ?? EMPTY_OVERRIDES);
  const baseline = useProjection(data, baselineOverrides ?? EMPTY_OVERRIDES);
  const b = active.budget;
  const debtMin = active.payoff.scheduledMonth0Cents;
  const committed = b.fixedCents + b.savingsCents + debtMin;
  const fcf = active.payoff.freeCashFlowCents;
  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const nowKey = monthKey(new Date());

  // Progress toward zero: from the earliest known consumer total (first snapshot) to today.
  const firstSnap = snapshots.find((s) => s.debts.length > 0);
  const startTotal = Math.max(active.consumerDebtCents, firstSnap ? firstSnap.debts.filter((d) => consumerDebts.some((c) => c.id === d.debtId)).reduce((s, d) => s + d.balanceCents, 0) : active.consumerDebtCents);
  const progress = startTotal > 0 ? Math.round(((startTotal - active.consumerDebtCents) / startTotal) * 100) : 0;
  const lastSnap = snapshots[snapshots.length - 1];
  const drift = lastSnap?.projectedPayoffMonth && baseline.payoff.outcome.kind === "paid" ? monthDiff(baseline.payoff.outcome.month, lastSnap.projectedPayoffMonth) : null;

  // Top 5 categories this month: actual spend from this month's check-in if any, otherwise budgeted flexible.
  const thisMonthSnap = snapshots.find((s) => s.month === nowKey && s.spend.length > 0);
  const topCats = (thisMonthSnap ? thisMonthSnap.spend.map((x) => ({ category: x.category, cents: x.amountCents })) : b.byCategory.map((c) => ({ category: c.category, cents: c.cents }))).sort((a, c) => c.cents - a.cents).slice(0, 5);

  // 12-month cash-flow strip
  const strip = active.payoff.months.slice(0, 12).map((m) => ({
    month: m.month,
    fixed: b.fixedCents,
    flexible: b.flexibleCents,
    savings: b.savingsCents,
    debt: m.scheduledCents + m.extraPoolCents,
  }));

  const insights = generateInsights(data, baseline, snapshots, { money, pct, month, lang, personName }).slice(0, 3);
  const nw = includeHome ? active.currentNetWorthWithHomeCents : active.currentNetWorthCents;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {/* Free cash flow */}
        <Card className={fcf < 0 ? "border-act" : ""}>
          <CardHeader><CardTitle>{t("dash.freeCashFlow")} <How>{lang === "fr" ? "Entrées vers le compte courant − engagé (fixes + épargne + paiements de dettes) − variables" : "Inflow to the spending account − committed (fixed + savings + debt payments) − flexible"}</How></CardTitle></CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold tabular ${fcf < 0 ? "text-act" : "text-good"}`}>
              {money(fcf, { sign: true })}<span className="text-sm font-normal text-muted-foreground">{t("common.perMonth")}</span>
            </div>
            <div className="text-xs mt-1">{fcf < 0 ? <Badge variant="act">▼ {lang === "fr" ? "déficit — la marge absorbe" : "deficit — the LOC absorbs it"}</Badge> : <Badge variant="good">▲ {lang === "fr" ? "surplus" : "surplus"}</Badge>}</div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.inflow")}</dt><dd><Money cents={b.inflowCents} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.committed")} <How>{lang === "fr" ? `Fixes ${money(b.fixedCents)} + épargne ${money(b.savingsCents)} + dettes ${money(debtMin)}` : `Fixed ${money(b.fixedCents)} + savings ${money(b.savingsCents)} + debt ${money(debtMin)}`}</How></dt><dd><Money cents={-committed} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.flexible")}</dt><dd><Money cents={-b.flexibleCents} /></dd></div>
            </dl>
          </CardContent>
        </Card>

        {/* Consumer debt */}
        <Card>
          <CardHeader><CardTitle>{t("dash.consumerDebt")} <How>{lang === "fr" ? "Marge + cartes. Projection selon le scénario par défaut" : "LOC + cards. Projection under the default scenario"}{activeScenario ? ` (${activeScenario.name})` : ""}.</How></CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular"><Money cents={active.consumerDebtCents} compact /></div>
            <Progress value={progress} className="mt-2" aria-label="Progress toward zero" />
            <div className="text-xs text-muted-foreground mt-1">{progress} % {lang === "fr" ? "remboursé depuis" : "paid since"} {firstSnap ? month(firstSnap.month) : lang === "fr" ? "aujourd'hui" : "today"}</div>
            <ul className="mt-2 space-y-0.5 text-sm">
              {consumerDebts.map((d) => <li key={d.id} className="flex justify-between"><span className="text-muted-foreground">{d.name}</span><Money cents={d.balanceCents} /></li>)}
            </ul>
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">{t("dash.debtFree")}: </span>
              <strong>{active.payoff.outcome.kind === "paid" ? `${month(active.payoff.outcome.month)} (${active.payoff.outcome.months} ${t("common.months")})` : t("common.never")}</strong>
              {drift !== null && <Badge className="ml-2" variant={drift > 0 ? "good" : drift < 0 ? "act" : "default"}>{drift > 0 ? `▲ ${drift} ${t("dash.monthsAhead")}` : drift < 0 ? `▼ ${-drift} ${t("dash.monthsBehind")}` : t("dash.onPlan")}</Badge>}
            </div>
            <Link href="/payoff" className="text-xs underline text-muted-foreground">{t("nav.payoff")} →</Link>
          </CardContent>
        </Card>

        {/* Net worth */}
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>{t("dash.netWorth")} <How>{lang === "fr" ? "Placements inclus − marge − cartes − autres dettes (hypothèque exclue sauf si la maison est incluse)." : "Included investments − LOC − cards − other debts (mortgage excluded unless home equity is on)."}</How></CardTitle>
            <label className="flex items-center gap-1 text-xs"><Switch checked={includeHome} onCheckedChange={setIncludeHome} /> {lang === "fr" ? "maison" : "home"}</label></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular"><Money cents={nw} compact /></div>
            <dl className="mt-3 space-y-1 text-sm">
              {[5, 10, 20].map((y) => { const r = active.netWorth[Math.min(y * 12, active.netWorth.length - 1)]; return r ? <div key={y} className="flex justify-between"><dt className="text-muted-foreground">{y} {t("common.years")}</dt><dd><Money cents={includeHome ? r.withHomeCents : r.cents} compact /></dd></div> : null; })}
            </dl>
            <Link href="/investments" className="text-xs underline text-muted-foreground">{t("nav.investments")} →</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("dash.topCategories")} {thisMonthSnap ? <Badge variant="default">{lang === "fr" ? "réel" : "actual"}</Badge> : <Badge variant="default">{lang === "fr" ? "budget" : "budgeted"}</Badge>}</CardTitle></CardHeader>
          <CardContent>
            {topCats.length === 0 ? <p className="text-sm text-muted-foreground">{lang === "fr" ? "Aucune dépense saisie." : "No expenses yet."}</p> : (
              <ul className="space-y-2">
                {topCats.map((c) => (
                  <li key={c.category} className="text-sm">
                    <div className="flex justify-between"><span>{c.category}</span><Money cents={c.cents} /></div>
                    <div className="h-2 rounded bg-muted mt-0.5"><div className="h-2 rounded bg-chart-1" style={{ width: `${Math.round((c.cents / topCats[0].cents) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.cashFlowStrip")} <How>{lang === "fr" ? "Fixes / variables / épargne du budget ; dettes = minimums + supplément + forfaitaires du mois." : "Budgeted fixed / flexible / savings; debt = minimums + extra + that month's lump sums."}</How></CardTitle></CardHeader>
          <CardContent>
            <BarsChart rows={strip} series={[{ key: "fixed", name: t("budget.fixed") }, { key: "flexible", name: t("budget.flexible") }, { key: "savings", name: lang === "fr" ? "Épargne" : "Savings" }, { key: "debt", name: lang === "fr" ? "Dettes" : "Debt" }]} stacked height={230} tick={(m) => m.slice(5)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.insights")}</CardTitle></CardHeader>
          <CardContent>
            {insights.length === 0 ? <p className="text-sm text-muted-foreground">{lang === "fr" ? "Rien à signaler." : "Nothing to flag."}</p> : (
              <ul className="space-y-2 text-sm">
                {insights.map((i) => (
                  <li key={i.key} className="flex gap-2">
                    <Badge variant={i.level} className="shrink-0 h-5">{i.level === "act" ? (lang === "fr" ? "agir" : "act") : i.level === "watch" ? (lang === "fr" ? "surveiller" : "watch") : "ok"}</Badge>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
