"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Copy, Save, Trash2, CalendarCheck, Scale, Target, Gift, Landmark, Table2, Sparkles, Bookmark } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { PageHeader, Callout, BigStat } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BalanceChart, type Series } from "@/components/charts/balance-chart";
import { EMPTY_OVERRIDES, monthsSooner, type ScenarioOverrides } from "@/lib/payoff";
import { monthDiff } from "@/lib/frequency";
import type { HouseholdDTO, ScenarioDTO, SnapshotDTO } from "@/lib/dto-household";
import { deleteScenario, duplicateScenario, saveScenario } from "@/lib/actions/scenarios";
import { useProjection } from "./use-projection";
import { summarize } from "./summary";
import { ScenarioControls } from "./scenario-controls";
import { Compare } from "./compare";
import { Solver } from "./solver";
import { BonusPanel } from "./bonus-panel";
import { DebtsPanel } from "./debts-panel";

export function PayoffClient({ data, scenarios, snapshots, initialScenarioId }: { data: HouseholdDTO; scenarios: ScenarioDTO[]; snapshots: SnapshotDTO[]; initialScenarioId: string | null }) {
  const { t, money, month, lang, pct } = useApp();
  const fr = lang === "fr";
  const router = useRouter();
  const baselineScenario = scenarios.find((s) => s.isBaseline) ?? scenarios[0];
  const [selectedId, setSelectedId] = React.useState<string>(initialScenarioId ?? data.settings.defaultScenarioId ?? baselineScenario?.id ?? "");
  const selected = scenarios.find((s) => s.id === selectedId) ?? baselineScenario;
  const [overrides, setOverrides] = React.useState<ScenarioOverrides>(selected?.overrides ?? EMPTY_OVERRIDES);
  const [name, setName] = React.useState(selected?.name ?? "");
  const [withBonuses, setWithBonuses] = React.useState(true);
  const [showTable, setShowTable] = React.useState(false);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (selected) {
      setOverrides(selected.overrides);
      setName(selected.name);
    }
  }, [selected]);
  const dirty = JSON.stringify(overrides) !== JSON.stringify(selected?.overrides ?? EMPTY_OVERRIDES);

  const baseline = useProjection(data, baselineScenario?.overrides ?? EMPTY_OVERRIDES);
  const current = useProjection(data, overrides);
  const withBonus = useProjection(data, overrides, { withBonuses: true });
  const hasUnconfirmedBonus = data.bonuses.some((b) => b.confidence === "UNCONFIRMED" && b.amountCents > 0);

  const lumpNames = data.lumpSumSchedules.filter((l) => l.active).map((l) => {
    const names = l.months.map((m) => new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1))));
    return `${names.join(fr ? " et " : " and ")} ${l.name.toLowerCase()}`;
  });
  const summary = summarize(current, overrides, { money, month, lang }, lumpNames);
  const bonusLine = hasUnconfirmedBonus && withBonus.payoff.outcome.kind === "paid" && current.payoff.outcome.kind === "paid"
    ? fr
      ? `Avec les bonis : sans dette en ${month(withBonus.payoff.outcome.month)}, ${monthsSooner(current.payoff, withBonus.payoff)} mois plus tôt, ${money(current.payoff.consumerInterestCents - withBonus.payoff.consumerInterestCents, { compact: true })} d’intérêts en moins.`
      : `With bonuses: debt-free on ${month(withBonus.payoff.outcome.month)}, ${monthsSooner(current.payoff, withBonus.payoff)} months sooner, ${money(current.payoff.consumerInterestCents - withBonus.payoff.consumerInterestCents, { compact: true })} less interest.`
    : null;

  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const isBaselineView = !!selected?.isBaseline && !dirty;
  const series: Series[] = [];
  if (!isBaselineView) series.push({ key: "baseline", name: t("payoff.baseline"), points: baseline.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), dashed: true, color: "var(--muted-foreground)" });
  series.push({ key: "scenario", name: isBaselineView ? (fr ? "Total" : "Total") : name || t("payoff.scenario"), points: current.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), color: "var(--chart-1)" });
  if (hasUnconfirmedBonus && withBonuses) series.push({ key: "bonus", name: fr ? "avec bonis (non confirmés)" : "with bonuses (unconfirmed)", points: withBonus.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), dotted: true, color: "var(--chart-3)" });
  consumerDebts.forEach((d, i) => series.push({ key: d.id, name: d.name, points: current.payoff.months.map((m) => ({ month: m.month, cents: m.debts[d.id]?.closingCents ?? 0 })), color: ["var(--chart-4)", "var(--chart-5)", "var(--chart-2)", "var(--chart-6)"][i % 4] }));

  const actuals = snapshots
    .map((s) => ({ month: s.month, cents: s.debts.filter((d) => consumerDebts.some((c) => c.id === d.debtId)).reduce((a, b) => a + b.balanceCents, 0) }))
    .filter((a) => a.cents > 0);
  const lastSnap = snapshots[snapshots.length - 1];
  const drift = lastSnap?.projectedPayoffMonth && baseline.payoff.outcome.kind === "paid" ? monthDiff(baseline.payoff.outcome.month, lastSnap.projectedPayoffMonth) : null;
  const fcf = current.payoff.freeCashFlowCents;
  const saved = baseline.payoff.consumerInterestCents - current.payoff.consumerInterestCents;
  const sooner = monthsSooner(baseline.payoff, current.payoff);

  async function onSave(asNew: boolean) {
    start(async () => {
      const res = await saveScenario(asNew || !selected ? null : selected.id, { name: name || (fr ? "Sans nom" : "Untitled"), description: selected?.description ?? null, overrides });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setSelectedId(res.data.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("payoff.title")} subtitle={fr ? "Quand serons-nous libres de dettes, et qu'est-ce qui change la date ?" : "When will we be debt-free, and what changes the date?"} />

      {/* Hero */}
      <Card>
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
            <BigStat
              icon={<CalendarCheck className="h-4 w-4" />}
              label={t("dash.debtFree")}
              value={current.payoff.outcome.kind === "paid" ? month(current.payoff.outcome.month) : t("common.never")}
              sub={current.payoff.outcome.kind === "paid" ? `${fr ? "dans" : "in"} ${current.payoff.outcome.months} ${t("common.months")} · ${money(current.consumerDebtCents, { compact: true })} ${fr ? "aujourd'hui" : "today"}` : undefined}
              tone={current.payoff.outcome.kind === "paid" ? undefined : "act"}
            />
            <div className="space-y-2 md:pl-6 md:border-l">
              <p className="text-base md:text-lg leading-snug">{summary}</p>
              {bonusLine && <p className="text-sm text-muted-foreground border-l-2 border-dotted border-chart-3 pl-2">{bonusLine}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline">{t("payoff.totalInterest")}: <strong className="tabular">{money(current.payoff.consumerInterestCents, { compact: true })}</strong> <How>{fr ? "Intérêts cumulés sur la marge et les cartes jusqu'au remboursement" : "Cumulative interest on the LOC and cards until payoff"}</How></Badge>
                {!isBaselineView && <Badge variant={saved > 0 ? "good" : saved < 0 ? "act" : "outline"}>{saved >= 0 ? "▲" : "▼"} {money(Math.abs(saved), { compact: true })} {fr ? "d’intérêts" : "interest"} {saved >= 0 ? (fr ? "économisés" : "saved") : (fr ? "de plus" : "more")}{sooner ? ` · ${Math.abs(sooner)} ${t("common.months")} ${sooner > 0 ? (fr ? "plus tôt" : "sooner") : (fr ? "plus tard" : "later")}` : ""} {fr ? "vs référence" : "vs baseline"}</Badge>}
                {drift !== null && <Badge variant={drift > 0 ? "good" : drift < 0 ? "act" : "outline"}>{drift > 0 ? `▲ ${drift} ${t("dash.monthsAhead")}` : drift < 0 ? `▼ ${-drift} ${t("dash.monthsBehind")}` : `✓ ${t("dash.onPlan")}`}</Badge>}
                <Badge variant={fcf < 0 ? "act" : "good"}>{t("dash.freeCashFlow")}: <strong className="tabular">{money(fcf, { sign: true })}</strong>{t("common.perMonth")}</Badge>
              </div>
            </div>
          </div>
          {fcf < 0 && (
            <Callout tone="act" icon={<AlertTriangle />}>
              {fr
                ? <>Le budget est court de <strong>{money(-fcf)}</strong> par mois avant les montants forfaitaires ; la marge de crédit finance ce manque chaque mois. Les paiements supplémentaires ci-dessous sont de l’argent neuf (coupes, hausse de salaire) — ils ne corrigent pas le déficit lui-même.</>
                : <>The budget is short <strong>{money(-fcf)}</strong> a month before lump sums; the line of credit finances that shortfall every month. Extra payments below are new money (cuts, a raise) — they do not fix the deficit itself.</>}
            </Callout>
          )}
          {fcf >= 0 && current.payoff.fundingGapCents > 0 && (
            <Callout tone="watch" icon={<AlertTriangle />}>{fr ? `Ce plan suppose ${money(current.payoff.fundingGapCents)}/mois de plus que le flux libre actuel (${money(fcf)}).` : `This plan assumes ${money(current.payoff.fundingGapCents)}/month more than the current free cash flow (${money(fcf)}).`}</Callout>
          )}
        </CardContent>
      </Card>

      {/* Plan picker */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Bookmark className="h-4 w-4" /> {fr ? "Plan" : "Plan"}</span>
        <Select className="w-auto h-9" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} aria-label={t("payoff.scenario")}>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isBaseline ? ` · ${t("payoff.baseline").toLowerCase()}` : ""}</option>)}
        </Select>
        {dirty && <Badge variant="watch">{fr ? "modifié" : "edited"}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(dirty || !selected?.isBaseline) && <Input className="h-9 w-40" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("common.name")} placeholder={fr ? "Nom du plan" : "Plan name"} />}
          {dirty && !selected?.isBaseline && <Button size="sm" disabled={pending} onClick={() => onSave(false)}><Save /> {t("common.save")}</Button>}
          {dirty && <Button size="sm" variant={selected?.isBaseline ? "default" : "outline"} disabled={pending} onClick={() => onSave(true)}><Copy /> {fr ? "Enregistrer comme nouveau plan" : "Save as new plan"}</Button>}
          {selected && !selected.isBaseline && !dirty && (
            <>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await duplicateScenario(selected.id); if (r.ok) { setSelectedId(r.data.id); router.refresh(); } else toast.error(r.error); })}><Copy /> {fr ? "Dupliquer" : "Duplicate"}</Button>
              <Button size="sm" variant="ghost" className="text-act" aria-label={t("common.delete")} disabled={pending} onClick={() => start(async () => { const r = await deleteScenario(selected.id); if (r.ok) { setSelectedId(baselineScenario.id); router.refresh(); } else toast.error(r.error); })}><Trash2 /></Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">{fr ? "Le chemin vers zéro" : "The path to zero"}</h2>
              {hasUnconfirmedBonus && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={withBonuses} onChange={(e) => setWithBonuses(e.target.checked)} /> {fr ? "montrer les bonis" : "show bonuses"}</label>}
            </div>
            <BalanceChart series={series} actuals={actuals} height={320} />
            {actuals.length > 0 && <p className="text-xs text-muted-foreground mt-1">● {fr ? "soldes réels des bilans mensuels" : "actual balances from monthly check-ins"}</p>}
          </CardContent>
        </Card>
        <ScenarioControls data={data} overrides={overrides} onChange={setOverrides} baseline={baseline} />
      </div>

      <Tabs defaultValue="compare">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="compare"><Scale className="h-4 w-4 mr-1.5" />{fr ? "Comparer des plans" : "Compare plans"}</TabsTrigger>
          <TabsTrigger value="solver"><Target className="h-4 w-4 mr-1.5" />{fr ? "Viser une date" : "Aim for a date"}</TabsTrigger>
          <TabsTrigger value="bonus"><Gift className="h-4 w-4 mr-1.5" />{fr ? "Bonis" : "Bonuses"}</TabsTrigger>
          <TabsTrigger value="debts"><Landmark className="h-4 w-4 mr-1.5" />{fr ? "Nos dettes" : "Our debts"}</TabsTrigger>
        </TabsList>
        <TabsContent value="compare" className="mt-3"><Compare data={data} scenarios={scenarios} current={{ name: name || t("payoff.scenario"), overrides }} /></TabsContent>
        <TabsContent value="solver" className="mt-3"><Solver projection={current} /></TabsContent>
        <TabsContent value="bonus" className="mt-3"><BonusPanel data={data} /></TabsContent>
        <TabsContent value="debts" className="mt-3"><DebtsPanel data={data} /></TabsContent>
      </Tabs>

      <Collapsible open={showTable} onOpenChange={setShowTable}>
        <Card>
          <CollapsibleTrigger className="p-5 rounded-2xl"><span className="flex items-center gap-2"><Table2 className="h-4 w-4 text-muted-foreground" /> {fr ? "Tableau mois par mois" : "Month-by-month table"}</span></CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{fr ? "Mois" : "Month"}</TableHead>
                    {consumerDebts.map((d) => <TableHead key={d.id} className="text-right">{d.name}</TableHead>)}
                    <TableHead className="text-right">{fr ? "Intérêts" : "Interest"}</TableHead>
                    <TableHead className="text-right">{fr ? "Capital" : "Principal"}</TableHead>
                    <TableHead className="text-right">{fr ? "Intérêts cumulés" : "Cum. interest"}</TableHead>
                    <TableHead>{fr ? "Événements" : "Events"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.payoff.months.slice(0, 120).map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="whitespace-nowrap">{m.month}</TableCell>
                      {consumerDebts.map((d) => <TableCell key={d.id} className="text-right"><Money cents={m.debts[d.id]?.closingCents ?? 0} compact /></TableCell>)}
                      <TableCell className="text-right"><Money cents={consumerDebts.reduce((s, d) => s + (m.debts[d.id]?.interestCents ?? 0), 0)} /></TableCell>
                      <TableCell className="text-right"><Money cents={consumerDebts.reduce((s, d) => s + (m.debts[d.id]?.scheduledCents ?? 0) + (m.debts[d.id]?.extraCents ?? 0) - (m.debts[d.id]?.interestCents ?? 0), 0)} /></TableCell>
                      <TableCell className="text-right"><Money cents={m.cumulativeInterestCents} compact /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.events.join(" · ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2"><Sparkles className="inline h-3 w-3 mr-1" />{fr ? "Taux courants : " : "Current rates: "}{consumerDebts.map((d) => `${d.name} ${pct(current.payoff.months[0]?.debts[d.id]?.rateBps ?? 0)}`).join(" · ")}</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
