"use client";
import * as React from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { How } from "@/components/app/how";
import { EMPTY_OVERRIDES, STRATEGIES, type ScenarioOverrides } from "@/lib/payoff";
import { toMonthlyCents } from "@/lib/frequency";
import type { HouseholdDTO } from "@/lib/dto-household";
import type { Projection } from "@/lib/projection";
import { parseMoney } from "@/lib/money";
import { useStartMonth } from "./use-projection";

export function ScenarioControls({ data, overrides, onChange, baseline }: { data: HouseholdDTO; overrides: ScenarioOverrides; onChange: (o: ScenarioOverrides) => void; baseline: Projection }) {
  const { t, money, lang } = useApp();
  const startMonth = useStartMonth();
  const set = (patch: Partial<ScenarioOverrides>) => onChange({ ...overrides, ...patch });
  const extra = overrides.extraMonthly?.cents ?? 0;
  const [extraText, setExtraText] = React.useState(String(extra / 100));
  React.useEffect(() => setExtraText(String(extra / 100)), [extra]);

  const strategyLabel: Record<(typeof STRATEGIES)[number], string> = lang === "fr"
    ? { AVALANCHE: "Avalanche (taux le plus élevé d'abord)", SNOWBALL: "Boule de neige (plus petit solde d'abord)", LOC_FIRST: "Marge d'abord" }
    : { AVALANCHE: "Avalanche (highest rate first)", SNOWBALL: "Snowball (smallest balance first)", LOC_FIRST: "LOC first" };

  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const categories = [...new Set(data.expenses.map((e) => e.category))].sort();
  const savingsLines = data.contributions.filter((c) => c.source !== "LUMP_SUM");
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? "?";

  // Cut editor state
  const [cutTarget, setCutTarget] = React.useState<string>("");
  const [cutMode, setCutMode] = React.useState<"pct" | "cents">("pct");
  const [cutValue, setCutValue] = React.useState("20");
  const [redirectId, setRedirectId] = React.useState(savingsLines[0]?.id ?? "");
  const [redirectMonths, setRedirectMonths] = React.useState("12");
  const [lumpMonth, setLumpMonth] = React.useState(startMonth);
  const [lumpAmount, setLumpAmount] = React.useState("");
  const [lumpLabel, setLumpLabel] = React.useState(lang === "fr" ? "Remboursement d'impôt" : "Tax refund");
  const [rateDebt, setRateDebt] = React.useState(consumerDebts[0]?.id ?? "");
  const [rateMonth, setRateMonth] = React.useState(startMonth);
  const [ratePct, setRatePct] = React.useState("");

  const cutFreed = overrides.expenseCuts.reduce((s, c) => {
    const rows = data.expenses.filter((e) => (c.expenseId && e.id === c.expenseId) || (c.category && e.category === c.category));
    return s + rows.reduce((a, e) => {
      const m = toMonthlyCents(e.amountCents, e.frequency);
      return a + (c.cents !== undefined ? Math.min(m, c.cents) : Math.round((m * (c.pct ?? 0)) / 100));
    }, 0);
  }, 0);

  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("payoff.scenario")}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_OVERRIDES)}><RotateCcw /> {lang === "fr" ? "Réinitialiser" : "Reset"}</Button>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* Extra */}
        <div className="space-y-2">
          <Label>{t("payoff.extra")} <How>{lang === "fr" ? "Argent neuf appliqué chaque mois à la dette prioritaire selon la stratégie, en plus des minimums, de l'allocation de garde et des montants forfaitaires." : "New money applied every month to the highest-priority debt under the strategy, on top of minimums, the child-care payment and lump sums."}</How></Label>
          <div className="flex items-center gap-3">
            <Slider value={[Math.min(extra, 500_000)]} min={0} max={500_000} step={5_000} onValueChange={(v) => set({ extraMonthly: { ...(overrides.extraMonthly ?? {}), cents: v[0] } })} aria-label={t("payoff.extra")} className="flex-1" />
            <Input className="w-28 h-8 text-right tabular" inputMode="decimal" value={extraText} onChange={(e) => setExtraText(e.target.value)} onBlur={() => { const c = parseMoney(extraText); if (c !== null) set({ extraMonthly: { ...(overrides.extraMonthly ?? {}), cents: c } }); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label={t("common.amount")} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{lang === "fr" ? "à partir de" : "starting"}</span>
            <input type="month" className="cell-input border-border w-auto" value={overrides.extraMonthly?.startMonth ?? startMonth} min={startMonth} onChange={(e) => set({ extraMonthly: { cents: extra, startMonth: e.target.value || null } })} aria-label="Start month" />
            {baseline.payoff.freeCashFlowCents > 0 && <span>· {lang === "fr" ? "flux libre" : "free cash flow"} {money(baseline.payoff.freeCashFlowCents)}</span>}
          </div>
        </div>

        {/* Strategy */}
        <div className="grid grid-cols-1 gap-2">
          <Label>{t("payoff.strategy")}</Label>
          <Select value={overrides.strategy} onChange={(e) => set({ strategy: e.target.value as ScenarioOverrides["strategy"] })} aria-label={t("payoff.strategy")}>
            {STRATEGIES.map((s) => <option key={s} value={s}>{strategyLabel[s]}</option>)}
          </Select>
          <label className="flex items-center justify-between gap-2">
            <span>{t("payoff.rollDown")} <How>{lang === "fr" ? "Quand un paiement prévu se termine (fin de location) ou diminue (solde d'une carte remboursé), le montant libéré est envoyé à la dette suivante." : "When a scheduled payment ends (lease over) or shrinks (card paid off), the freed amount goes to the next debt."}</How></span>
            <Switch checked={overrides.rollDown} onCheckedChange={(v) => set({ rollDown: v })} />
          </label>
        </div>

        {/* Recurring lump sums */}
        {data.lumpSumSchedules.filter((l) => l.active).map((l) => (
          <div key={l.id} className="space-y-1">
            <Label>{l.name} <span className="text-xs text-muted-foreground">({l.months.join(", ")})</span></Label>
            <div className="flex items-center gap-2">
              <Input className="h-8 w-32 text-right tabular" inputMode="decimal" defaultValue={((overrides.lumpSumScheduleCents[l.id] ?? l.amountCents) / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) set({ lumpSumScheduleCents: { ...overrides.lumpSumScheduleCents, [l.id]: c } }); }} aria-label={l.name} />
              <span className="text-xs text-muted-foreground">{lang === "fr" ? "par retrait" : "per withdrawal"}</span>
            </div>
          </div>
        ))}

        {/* One-off lump sums */}
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Montants forfaitaires additionnels" : "Additional lump sums"}</Label>
          {overrides.lumpSums.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1">
              <span>{l.month} · {l.label} · {money(l.cents)}</span>
              <button aria-label="Remove" onClick={() => set({ lumpSums: overrides.lumpSums.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 items-center">
            <input type="month" className="cell-input border-border" value={lumpMonth} min={startMonth} onChange={(e) => setLumpMonth(e.target.value)} aria-label="Month" />
            <Input className="h-8" placeholder={lang === "fr" ? "Libellé" : "Label"} value={lumpLabel} onChange={(e) => setLumpLabel(e.target.value)} />
            <Input className="h-8 text-right" inputMode="decimal" placeholder="$" value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)} aria-label={t("common.amount")} />
            <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("common.add")} onClick={() => { const c = parseMoney(lumpAmount); if (c && lumpMonth) { set({ lumpSums: [...overrides.lumpSums, { month: lumpMonth, cents: c, label: lumpLabel || "Lump sum" }] }); setLumpAmount(""); } }}><Plus /></Button>
          </div>
        </div>

        {/* Rate changes */}
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Changements de taux" : "Rate changes"}</Label>
          {overrides.rateChanges.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1">
              <span>{data.debts.find((d) => d.id === r.debtId)?.name} · {r.month} → {(r.annualRateBps / 100).toFixed(2)} %</span>
              <button aria-label="Remove" onClick={() => set({ rateChanges: overrides.rateChanges.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_5rem_auto] gap-1 items-center">
            <Select className="h-8" value={rateDebt} onChange={(e) => setRateDebt(e.target.value)} aria-label="Debt">{consumerDebts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            <input type="month" className="cell-input border-border" value={rateMonth} min={startMonth} onChange={(e) => setRateMonth(e.target.value)} aria-label="Month" />
            <Input className="h-8 text-right" inputMode="decimal" placeholder="%" value={ratePct} onChange={(e) => setRatePct(e.target.value)} aria-label="Rate" />
            <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("common.add")} onClick={() => { const p = Number(ratePct.replace(",", ".")); if (rateDebt && rateMonth && Number.isFinite(p)) { set({ rateChanges: [...overrides.rateChanges, { debtId: rateDebt, month: rateMonth, annualRateBps: Math.round(p * 100) }] }); setRatePct(""); } }}><Plus /></Button>
          </div>
        </div>

        {/* Expense cuts */}
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Coupes de dépenses" : "Expense cuts"} {cutFreed > 0 && <span className="text-xs text-good">· {lang === "fr" ? "libère" : "frees"} {money(cutFreed)}/{lang === "fr" ? "mois" : "month"}</span>} <How>{lang === "fr" ? "Une coupe augmente le flux libre du montant coupé. Combinez-la avec un paiement supplémentaire du même montant pour l'envoyer à la dette." : "A cut raises free cash flow by the amount cut. Pair it with an extra payment of the same amount to send it to debt."}</How></Label>
          {overrides.expenseCuts.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1">
              <span>{c.expenseId ? data.expenses.find((e) => e.id === c.expenseId)?.name : c.category} · −{c.cents !== undefined ? money(c.cents) : `${c.pct} %`}</span>
              <button aria-label="Remove" onClick={() => set({ expenseCuts: overrides.expenseCuts.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_4rem_auto] gap-1 items-center">
            <Select className="h-8" value={cutTarget} onChange={(e) => setCutTarget(e.target.value)} aria-label="Target">
              <option value="">—</option>
              <optgroup label={t("common.category")}>{categories.map((c) => <option key={`cat:${c}`} value={`cat:${c}`}>{c}</option>)}</optgroup>
              <optgroup label={lang === "fr" ? "Ligne" : "Line"}>{data.expenses.map((e) => <option key={e.id} value={`exp:${e.id}`}>{e.name}</option>)}</optgroup>
            </Select>
            <Select className="h-8 w-16" value={cutMode} onChange={(e) => setCutMode(e.target.value as "pct" | "cents")} aria-label="Mode"><option value="pct">%</option><option value="cents">$</option></Select>
            <Input className="h-8 text-right" inputMode="decimal" value={cutValue} onChange={(e) => setCutValue(e.target.value)} aria-label="Value" />
            <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("common.add")} disabled={!cutTarget} onClick={() => {
              const sep = cutTarget.indexOf(":");
              const kind = cutTarget.slice(0, sep);
              const id = cutTarget.slice(sep + 1);
              const cut = kind === "cat" ? { category: id } : { expenseId: id };
              const v = cutMode === "pct" ? { pct: Number(cutValue) } : { cents: parseMoney(cutValue) ?? 0 };
              set({ expenseCuts: [...overrides.expenseCuts, { ...cut, ...v }] });
            }}><Plus /></Button>
          </div>
        </div>

        {/* Redirect savings */}
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Rediriger une épargne vers la dette" : "Redirect a savings line to debt"} <How>{lang === "fr" ? "La cotisation est suspendue N mois et le même montant est payé sur la dette. La projection des placements en tient compte." : "The contribution pauses for N months and the same amount is paid on the debt. The investment projection reflects it."}</How></Label>
          {overrides.redirects.map((r, i) => {
            const c = data.contributions.find((x) => x.id === r.contributionId);
            return (
              <div key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1">
                <span>{c ? `${accountName(c.accountId)} · ${money(toMonthlyCents(c.amountCents, c.frequency))}/m` : "?"} · {r.months} {t("common.months")}{r.startMonth ? ` · ${r.startMonth}` : ""}</span>
                <button aria-label="Remove" onClick={() => set({ redirects: overrides.redirects.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
              </div>
            );
          })}
          {savingsLines.length === 0 ? <p className="text-xs text-muted-foreground">{lang === "fr" ? "Aucune ligne d'épargne dans le budget." : "No savings lines in the budget."}</p> : (
            <div className="grid grid-cols-[1fr_4rem_auto] gap-1 items-center">
              <Select className="h-8" value={redirectId} onChange={(e) => setRedirectId(e.target.value)} aria-label="Contribution">
                {savingsLines.map((c) => <option key={c.id} value={c.id}>{accountName(c.accountId)} · {money(toMonthlyCents(c.amountCents, c.frequency))}/m{c.incomeId ? (lang === "fr" ? " (paie)" : " (payroll)") : ""}</option>)}
              </Select>
              <Input className="h-8 text-right" inputMode="numeric" value={redirectMonths} onChange={(e) => setRedirectMonths(e.target.value)} aria-label={t("common.months")} />
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label={t("common.add")} disabled={!redirectId} onClick={() => set({ redirects: [...overrides.redirects, { contributionId: redirectId, months: Math.max(1, Number(redirectMonths) || 12), startMonth: startMonth }] })}><Plus /></Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{lang === "fr" ? `Tampon d'encaisse minimal : ${money(data.settings.cashBufferCents)} (réglages). Les scénarios n'envoient jamais le fonds d'urgence à la dette.` : `Minimum cash buffer: ${money(data.settings.cashBufferCents)} (Settings). Scenarios never send the emergency fund to debt.`}</p>
      </CardContent>
    </Card>
  );
}
