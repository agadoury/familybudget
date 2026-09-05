"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Copy, Save, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const router = useRouter();
  const baselineScenario = scenarios.find((s) => s.isBaseline) ?? scenarios[0];
  const [selectedId, setSelectedId] = React.useState<string>(initialScenarioId ?? data.settings.defaultScenarioId ?? baselineScenario?.id ?? "");
  const selected = scenarios.find((s) => s.id === selectedId) ?? baselineScenario;
  const [overrides, setOverrides] = React.useState<ScenarioOverrides>(selected?.overrides ?? EMPTY_OVERRIDES);
  const [name, setName] = React.useState(selected?.name ?? "");
  const [withBonuses, setWithBonuses] = React.useState(true);
  const [showTable, setShowTable] = React.useState(false);
  const [pending, start] = React.useTransition();

  // Re-sync the working copy when the selection or the saved scenarios change.
  React.useEffect(() => {
    if (selected) {
      setOverrides(selected.overrides);
      setName(selected.name);
    }
  }, [selected]);
  const dirty = JSON.stringify(overrides) !== JSON.stringify(selected?.overrides ?? EMPTY_OVERRIDES);

  const baselineOverrides = baselineScenario?.overrides ?? EMPTY_OVERRIDES;
  const baseline = useProjection(data, baselineOverrides);
  const current = useProjection(data, overrides);
  const withBonus = useProjection(data, overrides, { withBonuses: true });
  const hasUnconfirmedBonus = data.bonuses.some((b) => b.confidence === "UNCONFIRMED" && b.amountCents > 0);

  const lumpNames = data.lumpSumSchedules.filter((l) => l.active).map((l) => {
    const names = l.months.map((m) => new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1))));
    return `${names.join(lang === "fr" ? " et " : " and ")} ${l.name.toLowerCase()}`;
  });
  const summary = summarize(current, overrides, { money, month, lang }, lumpNames);
  const bonusLine = hasUnconfirmedBonus && withBonus.payoff.outcome.kind === "paid" && current.payoff.outcome.kind === "paid"
    ? lang === "fr"
      ? `Avec les bonis : sans dette en ${month(withBonus.payoff.outcome.month)}, ${monthsSooner(current.payoff, withBonus.payoff)} mois plus tôt, ${money(current.payoff.consumerInterestCents - withBonus.payoff.consumerInterestCents, { compact: true })} d'intérêts en moins.`
      : `With bonuses: debt-free on ${month(withBonus.payoff.outcome.month)}, ${monthsSooner(current.payoff, withBonus.payoff)} months sooner, ${money(current.payoff.consumerInterestCents - withBonus.payoff.consumerInterestCents, { compact: true })} less interest.`
    : null;

  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const series: Series[] = [
    { key: "baseline", name: t("payoff.baseline"), points: baseline.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), dashed: true, color: "var(--muted-foreground)" },
  ];
  if (selected && !selected.isBaseline || dirty) series.push({ key: "scenario", name: name || t("payoff.scenario"), points: current.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), color: "var(--chart-1)" });
  if (hasUnconfirmedBonus && withBonuses) series.push({ key: "bonus", name: lang === "fr" ? "avec bonis (non confirmés)" : "with bonuses (unconfirmed)", points: withBonus.payoff.months.map((m) => ({ month: m.month, cents: m.consumerBalanceCents })), dotted: true, color: "var(--chart-3)" });
  for (const d of consumerDebts) series.push({ key: d.id, name: d.name, points: current.payoff.months.map((m) => ({ month: m.month, cents: m.debts[d.id]?.closingCents ?? 0 })), dashed: false, color: undefined });

  // Plan vs actual: snapshots' consumer balances against the baseline curve.
  const actuals = snapshots
    .map((s) => ({ month: s.month, cents: s.debts.filter((d) => consumerDebts.some((c) => c.id === d.debtId)).reduce((a, b) => a + b.balanceCents, 0) }))
    .filter((a) => a.cents > 0);
  const lastSnap = snapshots[snapshots.length - 1];
  const drift = (() => {
    if (!lastSnap?.projectedPayoffMonth || baseline.payoff.outcome.kind !== "paid") return null;
    return monthDiff(baseline.payoff.outcome.month, lastSnap.projectedPayoffMonth); // positive = ahead of the plan saved at the last check-in
  })();

  const fcf = current.payoff.freeCashFlowCents;

  async function onSave(asNew: boolean) {
    start(async () => {
      const res = await saveScenario(asNew || !selected ? null : selected.id, { name: name || (lang === "fr" ? "Sans nom" : "Untitled"), description: selected?.description ?? null, overrides });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setSelectedId(res.data.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("payoff.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-auto h-8" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} aria-label={t("payoff.scenario")}>
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isBaseline ? ` (${t("payoff.baseline").toLowerCase()})` : ""}</option>)}
          </Select>
          <Input className="h-8 w-44" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("common.name")} />
          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={pending || selected?.isBaseline && dirty === false} onClick={() => onSave(false)} title={t("common.save")}><Save /> {t("common.save")}</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onSave(true)}><Copy /> {lang === "fr" ? "Enregistrer sous" : "Save as new"}</Button>
          {selected && !selected.isBaseline && (
            <>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await duplicateScenario(selected.id); if (r.ok) { setSelectedId(r.data.id); router.refresh(); } else toast.error(r.error); })}>{lang === "fr" ? "Dupliquer" : "Duplicate"}</Button>
              <Button size="sm" variant="ghost" className="text-act" disabled={pending} onClick={() => start(async () => { const r = await deleteScenario(selected.id); if (r.ok) { setSelectedId(baselineScenario.id); router.refresh(); } else toast.error(r.error); })}><Trash2 /></Button>
            </>
          )}
        </div>
      </div>

      {/* Plain-language summary */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-base font-medium">{summary}</p>
          {bonusLine && <p className="text-sm text-muted-foreground border-l-2 border-dotted border-chart-3 pl-2">{bonusLine}</p>}
          {fcf < 0 && (
            <p className="flex items-start gap-2 text-sm rounded-md bg-act-bg text-act p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {lang === "fr"
                  ? `Le budget est déficitaire de ${money(-fcf)}/mois avant les montants forfaitaires ; ce manque est financé par la marge de crédit chaque mois. Les paiements supplémentaires ci-dessous sont de l'argent neuf (coupes, hausse de salaire) — ils ne corrigent pas le déficit lui-même.`
                  : `The budget is short ${money(-fcf)}/month before lump sums; the LOC finances that shortfall every month. Extra payments below are new money (cuts, a raise) — they do not fix the deficit itself.`}
              </span>
            </p>
          )}
          {fcf >= 0 && current.payoff.fundingGapCents > 0 && (
            <p className="flex items-start gap-2 text-sm rounded-md bg-watch-bg text-watch p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{lang === "fr" ? `Ce scénario suppose ${money(current.payoff.fundingGapCents)}/mois de plus que le flux libre actuel (${money(fcf)}).` : `This scenario assumes ${money(current.payoff.fundingGapCents)}/month more than the current free cash flow (${money(fcf)}).`}</span>
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm pt-1">
            <Stat label={t("dash.consumerDebt")} value={money(current.consumerDebtCents, { compact: true })} />
            <Stat label={t("dash.debtFree")} value={current.payoff.outcome.kind === "paid" ? month(current.payoff.outcome.month) : t("common.never")} />
            <Stat label={t("payoff.totalInterest")} value={money(current.payoff.consumerInterestCents, { compact: true })} how={lang === "fr" ? "Intérêts cumulés sur la marge et les cartes jusqu'au remboursement" : "Cumulative interest on the LOC and cards until payoff"} />
            <Stat label={t("payoff.interestSaved")} value={money(baseline.payoff.consumerInterestCents - current.payoff.consumerInterestCents, { compact: true, sign: true })} tone={baseline.payoff.consumerInterestCents - current.payoff.consumerInterestCents > 0 ? "good" : undefined} />
            <Stat label={t("dash.freeCashFlow")} value={money(fcf, { sign: true })} tone={fcf < 0 ? "act" : "good"} how={lang === "fr" ? "Entrées − fixes − variables − épargne − paiements de dettes du mois courant" : "Inflow − fixed − flexible − savings − this month's scheduled debt payments"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{lang === "fr" ? "Soldes projetés" : "Projected balances"}</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              {hasUnconfirmedBonus && <label className="flex items-center gap-1"><input type="checkbox" checked={withBonuses} onChange={(e) => setWithBonuses(e.target.checked)} /> {lang === "fr" ? "bonis" : "bonuses"}</label>}
              {drift !== null && (
                <Badge variant={drift > 0 ? "good" : drift < 0 ? "act" : "default"}>
                  {drift > 0 ? `${drift} ${t("dash.monthsAhead")}` : drift < 0 ? `${-drift} ${t("dash.monthsBehind")}` : t("dash.onPlan")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <BalanceChart series={series} actuals={actuals} height={320} />
            {actuals.length > 0 && <p className="text-xs text-muted-foreground mt-1">● {lang === "fr" ? "soldes réels des bilans mensuels" : "actual balances from monthly check-ins"}</p>}
          </CardContent>
        </Card>
        <ScenarioControls data={data} overrides={overrides} onChange={setOverrides} baseline={baseline} />
      </div>

      <Tabs defaultValue="compare">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="compare">{t("payoff.compare")}</TabsTrigger>
          <TabsTrigger value="solver">{t("payoff.solver")}</TabsTrigger>
          <TabsTrigger value="bonus">{t("payoff.bonus")}</TabsTrigger>
          <TabsTrigger value="debts">{lang === "fr" ? "Dettes" : "Debts"}</TabsTrigger>
        </TabsList>
        <TabsContent value="compare"><Compare data={data} scenarios={scenarios} current={{ name: name || t("payoff.scenario"), overrides }} /></TabsContent>
        <TabsContent value="solver"><Solver projection={current} /></TabsContent>
        <TabsContent value="bonus"><BonusPanel data={data} /></TabsContent>
        <TabsContent value="debts"><DebtsPanel data={data} /></TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <button className="flex items-center gap-1 text-sm font-semibold" onClick={() => setShowTable((v) => !v)}>
            {showTable ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {lang === "fr" ? "Tableau mois par mois" : "Month-by-month table"}
          </button>
        </CardHeader>
        {showTable && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === "fr" ? "Mois" : "Month"}</TableHead>
                  {consumerDebts.map((d) => <TableHead key={d.id} className="text-right">{d.name}</TableHead>)}
                  <TableHead className="text-right">{lang === "fr" ? "Intérêts" : "Interest"}</TableHead>
                  <TableHead className="text-right">{lang === "fr" ? "Capital" : "Principal"}</TableHead>
                  <TableHead className="text-right">{lang === "fr" ? "Intérêts cumulés" : "Cum. interest"}</TableHead>
                  <TableHead>{lang === "fr" ? "Événements" : "Events"}</TableHead>
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
            <p className="text-xs text-muted-foreground mt-2">
              {lang === "fr" ? "Taux courants : " : "Current rates: "}{consumerDebts.map((d) => `${d.name} ${pct(current.payoff.months[0]?.debts[d.id]?.rateBps ?? 0)}`).join(" · ")}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, how }: { label: string; value: string; tone?: "good" | "act" | "watch"; how?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label} {how && <How>{how}</How>}</div>
      <div className={`font-semibold tabular ${tone === "good" ? "text-good" : tone === "act" ? "text-act" : tone === "watch" ? "text-watch" : ""}`}>{value}</div>
    </div>
  );
}
