"use client";
import * as React from "react";
import Link from "next/link";
import { Wallet, CreditCard, Sprout, Lightbulb, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { BigStat, Callout } from "@/components/app/page";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BarsChart } from "@/components/charts/bars-chart";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import { monthDiff, monthKey } from "@/lib/frequency";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";
import { generateInsights } from "@/lib/insights/rules";
import { useProjection } from "./payoff/use-projection";

export function Dashboard({ data, activeScenario, baselineOverrides, snapshots }: { data: HouseholdDTO; activeScenario: { id: string; name: string; overrides: ScenarioOverrides } | null; baselineOverrides: ScenarioOverrides | null; snapshots: SnapshotDTO[] }) {
  const { t, money, month, lang, pct, personName, editor, names } = useApp();
  const fr = lang === "fr";
  const [includeHome, setIncludeHome] = React.useState(data.settings.includeHomeEquity);
  const active = useProjection(data, activeScenario?.overrides ?? EMPTY_OVERRIDES);
  const baseline = useProjection(data, baselineOverrides ?? EMPTY_OVERRIDES);
  const b = active.budget;
  const debtMin = active.payoff.scheduledMonth0Cents;
  const committed = b.fixedCents + b.savingsCents + debtMin;
  const fcf = active.payoff.freeCashFlowCents;
  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const nowKey = monthKey(new Date());

  const firstSnap = snapshots.find((s) => s.debts.length > 0);
  const startTotal = Math.max(active.consumerDebtCents, firstSnap ? firstSnap.debts.filter((d) => consumerDebts.some((c) => c.id === d.debtId)).reduce((s, d) => s + d.balanceCents, 0) : active.consumerDebtCents);
  const progress = startTotal > 0 ? Math.round(((startTotal - active.consumerDebtCents) / startTotal) * 100) : 0;
  const lastSnap = snapshots[snapshots.length - 1];
  const drift = lastSnap?.projectedPayoffMonth && baseline.payoff.outcome.kind === "paid" ? monthDiff(baseline.payoff.outcome.month, lastSnap.projectedPayoffMonth) : null;
  const thisMonthSnap = snapshots.find((s) => s.month === nowKey && s.spend.length > 0);
  const topCats = (thisMonthSnap ? thisMonthSnap.spend.map((x) => ({ category: x.category, cents: x.amountCents })) : b.byCategory.map((c) => ({ category: c.category, cents: c.cents }))).sort((a, c) => c.cents - a.cents).slice(0, 5);
  const strip = active.payoff.months.slice(0, 12).map((m) => ({ month: m.month, fixed: b.fixedCents, flexible: b.flexibleCents, savings: b.savingsCents, debt: m.scheduledCents + m.extraPoolCents }));
  const insights = generateInsights(data, baseline, snapshots, { money, pct, month, lang, personName }).slice(0, 3);
  const nw = includeHome ? active.currentNetWorthWithHomeCents : active.currentNetWorthCents;
  const checkedInThisMonth = snapshots.some((s) => s.month === nowKey);
  const hour = new Date().getHours();
  const greeting = fr ? (hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir") : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{greeting}, {names[editor]}.</h1>
          <p className="text-muted-foreground mt-1">
            {fcf < 0
              ? fr ? <>Il sort <strong className="text-act">{money(-fcf)}</strong> de plus qu’il n’entre chaque mois.</> : <>You spend <strong className="text-act">{money(-fcf)}</strong> more than comes in each month.</>
              : fr ? <>Il reste <strong className="text-good">{money(fcf)}</strong> chaque mois une fois tout payé.</> : <>You have <strong className="text-good">{money(fcf)}</strong> left each month after everything is paid.</>}
            {" "}{active.payoff.outcome.kind === "paid" ? (fr ? <>Sans dette en <strong>{month(active.payoff.outcome.month)}</strong>.</> : <>Debt-free in <strong>{month(active.payoff.outcome.month)}</strong>.</>) : null}
          </p>
        </div>
        {!checkedInThisMonth && <Button asChild variant="soft"><Link href="/checkin">{fr ? "Faire le bilan du mois" : "Do this month's check-in"} <ArrowRight /></Link></Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Free cash flow */}
        <Card className={fcf < 0 ? "border-act/40" : ""}>
          <CardContent className="p-5 space-y-4">
            <BigStat icon={<Wallet className="h-4 w-4" />} label={t("dash.freeCashFlow")} value={money(fcf, { sign: true })} tone={fcf < 0 ? "act" : "good"}
              sub={<span className="inline-flex items-center gap-1">{fcf < 0 ? <TrendingDown className="h-3.5 w-3.5 text-act" /> : <TrendingUp className="h-3.5 w-3.5 text-good" />}{fcf < 0 ? (fr ? "déficit — la marge absorbe" : "deficit — the LOC absorbs it") : (fr ? "surplus chaque mois" : "surplus every month")} <How>{fr ? "Entrées vers le compte courant − engagé (fixes + épargne + paiements de dettes) − variables" : "Inflow to the spending account − committed (fixed + savings + debt payments) − flexible"}</How></span>} />
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.inflow")}</dt><dd><Money cents={b.inflowCents} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.committed")} <How>{fr ? `Fixes ${money(b.fixedCents)} + épargne ${money(b.savingsCents)} + dettes ${money(debtMin)}` : `Fixed ${money(b.fixedCents)} + savings ${money(b.savingsCents)} + debt ${money(debtMin)}`}</How></dt><dd><Money cents={-committed} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("dash.flexible")}</dt><dd><Money cents={-b.flexibleCents} /></dd></div>
            </dl>
            <Link href="/budget" className="text-sm text-primary font-medium inline-flex items-center gap-1">{t("nav.budget")} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>

        {/* Consumer debt */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <BigStat icon={<CreditCard className="h-4 w-4" />} label={t("dash.consumerDebt")} value={money(active.consumerDebtCents, { compact: true })}
              sub={<>{active.payoff.outcome.kind === "paid" ? `${t("dash.debtFree")} ${month(active.payoff.outcome.month)} · ${active.payoff.outcome.months} ${t("common.months")}` : t("common.never")} <How>{fr ? "Marge + cartes, selon le plan par défaut" : "LOC + cards, under the default plan"}{activeScenario ? ` (${activeScenario.name})` : ""}</How></>} />
            <div>
              <Progress value={progress} aria-label="Progress toward zero" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>{progress} % {fr ? "remboursé depuis" : "paid since"} {firstSnap ? month(firstSnap.month) : fr ? "aujourd'hui" : "today"}</span>{drift !== null && <Badge variant={drift > 0 ? "good" : drift < 0 ? "act" : "default"}>{drift > 0 ? `▲ ${drift} ${t("dash.monthsAhead")}` : drift < 0 ? `▼ ${-drift} ${t("dash.monthsBehind")}` : `✓ ${t("dash.onPlan")}`}</Badge>}</div>
            </div>
            <ul className="space-y-1 text-sm">
              {consumerDebts.map((d) => <li key={d.id} className="flex justify-between"><span className="text-muted-foreground">{d.name}</span><Money cents={d.balanceCents} /></li>)}
            </ul>
            <Link href="/payoff" className="text-sm text-primary font-medium inline-flex items-center gap-1">{t("nav.payoff")} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>

        {/* Net worth */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <BigStat icon={<Sprout className="h-4 w-4" />} label={t("dash.netWorth")} value={money(nw, { compact: true })} sub={<>{fr ? "placements − dettes" : "investments − debts"} <How>{fr ? "Placements inclus − marge − cartes − autres dettes (hypothèque exclue sauf si la maison est incluse)." : "Included investments − LOC − cards − other debts (mortgage excluded unless home equity is on)."}</How></>} />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={includeHome} onCheckedChange={setIncludeHome} /> {fr ? "maison" : "home"}</label>
            </div>
            <dl className="space-y-1.5 text-sm">
              {[5, 10, 20].map((y) => { const r = active.netWorth[Math.min(y * 12, active.netWorth.length - 1)]; return r ? <div key={y} className="flex justify-between"><dt className="text-muted-foreground">{fr ? "Dans" : "In"} {y} {t("common.years")}</dt><dd><Money cents={includeHome ? r.withHomeCents : r.cents} compact /></dd></div> : null; })}
            </dl>
            <Link href="/investments" className="text-sm text-primary font-medium inline-flex items-center gap-1">{t("nav.investments")} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3">{t("dash.topCategories")} <Badge variant="default" className="ml-1">{thisMonthSnap ? (fr ? "réel" : "actual") : (fr ? "budget" : "budgeted")}</Badge></h2>
            {topCats.length === 0 ? <p className="text-sm text-muted-foreground">{fr ? "Aucune dépense saisie." : "No expenses yet."}</p> : (
              <ul className="space-y-2.5">
                {topCats.map((c) => (
                  <li key={c.category} className="text-sm">
                    <div className="flex justify-between"><span>{c.category}</span><Money cents={c.cents} /></div>
                    <div className="h-2 rounded-full bg-muted mt-1"><div className="h-2 rounded-full bg-chart-1" style={{ width: `${Math.round((c.cents / topCats[0].cents) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3">{t("dash.cashFlowStrip")} <How>{fr ? "Fixes / variables / épargne du budget ; dettes = minimums + supplément + forfaitaires du mois." : "Budgeted fixed / flexible / savings; debt = minimums + extra + that month's lump sums."}</How></h2>
            <BarsChart rows={strip} series={[{ key: "fixed", name: t("budget.fixed") }, { key: "flexible", name: t("budget.flexible") }, { key: "savings", name: fr ? "Épargne" : "Savings" }, { key: "debt", name: fr ? "Dettes" : "Debt" }]} stacked height={230} tick={(m) => m.slice(5)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3"><h2 className="font-semibold flex items-center gap-2"><Lightbulb className="h-4 w-4 text-watch" /> {t("dash.insights")}</h2><Link href="/insights" className="text-sm text-primary font-medium inline-flex items-center gap-1">{fr ? "Tous les conseils" : "All advice"} <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            {insights.length === 0 ? <p className="text-sm text-muted-foreground">{fr ? "Rien à signaler." : "Nothing to flag."}</p> : (
              <div className="space-y-2">
                {insights.map((i) => <Callout key={i.key} tone={i.level}>{i.text}</Callout>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
