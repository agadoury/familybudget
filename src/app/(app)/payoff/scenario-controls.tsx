"use client";
import * as React from "react";
import { Plus, RotateCcw, X, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { How } from "@/components/app/how";
import { EMPTY_OVERRIDES, STRATEGIES, type ScenarioOverrides } from "@/lib/payoff";
import { toMonthlyCents } from "@/lib/frequency";
import type { HouseholdDTO } from "@/lib/dto-household";
import type { Projection } from "@/lib/projection";
import { parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useStartMonth } from "./use-projection";

export function ScenarioControls({ data, overrides, onChange, baseline }: { data: HouseholdDTO; overrides: ScenarioOverrides; onChange: (o: ScenarioOverrides) => void; baseline: Projection }) {
  const { t, money, lang } = useApp();
  const fr = lang === "fr";
  const startMonth = useStartMonth();
  const set = (patch: Partial<ScenarioOverrides>) => onChange({ ...overrides, ...patch });
  const extra = overrides.extraMonthly?.cents ?? 0;
  const [extraText, setExtraText] = React.useState(String(extra / 100));
  React.useEffect(() => setExtraText(String(extra / 100)), [extra]);

  const strategy: Record<(typeof STRATEGIES)[number], { label: string; hint: string }> = fr
    ? { AVALANCHE: { label: "Taux le plus élevé d'abord", hint: "Les cartes, puis la marge. Le moins d'intérêts." }, SNOWBALL: { label: "Plus petit solde d'abord", hint: "Des victoires rapides, un peu plus d'intérêts." }, LOC_FIRST: { label: "Marge d'abord", hint: "Ce que nous faisons aujourd'hui." } }
    : { AVALANCHE: { label: "Highest rate first", hint: "Cards, then the LOC. Least interest." }, SNOWBALL: { label: "Smallest balance first", hint: "Quick wins, a little more interest." }, LOC_FIRST: { label: "LOC first", hint: "What we do today." } };

  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const categories = [...new Set(data.expenses.map((e) => e.category))].sort();
  const savingsLines = data.contributions.filter((c) => c.source !== "LUMP_SUM");
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? "?";

  const [cutTarget, setCutTarget] = React.useState<string>("");
  const [cutMode, setCutMode] = React.useState<"pct" | "cents">("pct");
  const [cutValue, setCutValue] = React.useState("20");
  const [redirectId, setRedirectId] = React.useState(savingsLines[0]?.id ?? "");
  const [redirectMonths, setRedirectMonths] = React.useState("12");
  const [lumpMonth, setLumpMonth] = React.useState(startMonth);
  const [lumpAmount, setLumpAmount] = React.useState("");
  const [lumpLabel, setLumpLabel] = React.useState(fr ? "Remboursement d'impôt" : "Tax refund");
  const [rateDebt, setRateDebt] = React.useState(consumerDebts[0]?.id ?? "");
  const [rateMonth, setRateMonth] = React.useState(startMonth);
  const [ratePct, setRatePct] = React.useState("");

  const cutFreed = overrides.expenseCuts.reduce((s, c) => {
    const rows = data.expenses.filter((e) => (c.expenseId && e.id === c.expenseId) || (c.category && e.category === c.category));
    return s + rows.reduce((a, e) => { const m = toMonthlyCents(e.amountCents, e.frequency); return a + (c.cents !== undefined ? Math.min(m, c.cents) : Math.round((m * (c.pct ?? 0)) / 100)); }, 0);
  }, 0);
  const advancedCount = overrides.lumpSums.length + overrides.rateChanges.length + overrides.expenseCuts.length + overrides.redirects.length + Object.keys(overrides.lumpSumScheduleCents).length;
  const isDefault = JSON.stringify(overrides) === JSON.stringify(EMPTY_OVERRIDES);

  const Chip = ({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) => (
    <div className="flex items-center justify-between gap-2 text-xs rounded-lg bg-muted px-2.5 py-1.5">
      <span>{children}</span>
      <button aria-label="Remove" onClick={onRemove} className="text-muted-foreground hover:text-act"><X className="h-3.5 w-3.5" /></button>
    </div>
  );

  return (
    <Card className="h-fit">
      <CardContent className="p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /> {fr ? "Essayer des changements" : "Try changes"}</h2>
          {!isDefault && <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_OVERRIDES)}><RotateCcw /> {fr ? "Réinitialiser" : "Reset"}</Button>}
        </div>

        {/* Extra */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">{fr ? "Payer en plus chaque mois" : "Pay extra every month"} <How>{fr ? "Argent neuf appliqué chaque mois à la dette prioritaire, en plus des minimums, de l'allocation de garde et des montants forfaitaires." : "New money applied every month to the top-priority debt, on top of minimums, the child-care payment and lump sums."}</How></Label>
            <div className="flex items-center gap-1">
              <Input className="w-24 h-9 text-right tabular font-semibold" inputMode="decimal" value={extraText} onChange={(e) => setExtraText(e.target.value)} onBlur={() => { const c = parseMoney(extraText); if (c !== null) set({ extraMonthly: { ...(overrides.extraMonthly ?? {}), cents: c } }); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label={t("common.amount")} />
              <span className="text-sm text-muted-foreground">$</span>
            </div>
          </div>
          <Slider value={[Math.min(extra, 500_000)]} min={0} max={500_000} step={5_000} onValueChange={(v) => set({ extraMonthly: { ...(overrides.extraMonthly ?? {}), cents: v[0] } })} aria-label={t("payoff.extra")} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0 $</span>
            <span className="flex items-center gap-1">{fr ? "à partir de" : "from"} <input type="month" className="cell-input border-border w-auto py-0.5 text-xs" value={overrides.extraMonthly?.startMonth ?? startMonth} min={startMonth} onChange={(e) => set({ extraMonthly: { cents: extra, startMonth: e.target.value || null } })} aria-label="Start month" /></span>
            <span>5 000 $</span>
          </div>
          {baseline.payoff.freeCashFlowCents > 0 && <p className="text-xs text-muted-foreground">{fr ? "Flux libre disponible" : "Free cash flow available"}: {money(baseline.payoff.freeCashFlowCents)}</p>}
        </div>

        {/* Strategy */}
        <div className="space-y-2">
          <Label className="text-sm">{fr ? "Dans quel ordre rembourser" : "Which debt to pay first"}</Label>
          <div className="grid gap-1.5">
            {STRATEGIES.map((s) => (
              <button key={s} type="button" onClick={() => set({ strategy: s })} aria-pressed={overrides.strategy === s}
                className={cn("flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors", overrides.strategy === s ? "border-primary bg-primary-soft" : "hover:bg-accent")}>
                <span><span className="font-medium">{strategy[s].label}</span><span className="block text-xs text-muted-foreground">{strategy[s].hint}</span></span>
                <span className={cn("h-4 w-4 rounded-full border-2 shrink-0", overrides.strategy === s ? "border-primary bg-primary" : "border-muted-foreground/40")} />
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="text-sm"><span className="font-medium">{fr ? "Réutiliser les paiements terminés" : "Reuse payments that end"}</span><span className="block text-xs text-muted-foreground">{fr ? "Quand une location finit ou une carte est réglée, le montant libéré va à la dette suivante." : "When a lease ends or a card is paid off, the freed amount goes to the next debt."}</span></span>
          <Switch checked={overrides.rollDown} onCheckedChange={(v) => set({ rollDown: v })} />
        </label>

        {/* Advanced */}
        <Collapsible defaultOpen={advancedCount > 0}>
          <CollapsibleTrigger className="-mx-1">{fr ? "Plus d'options" : "More options"}{advancedCount > 0 ? ` (${advancedCount})` : ""}</CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-3 text-sm">
            {data.lumpSumSchedules.filter((l) => l.active).map((l) => (
              <div key={l.id} className="space-y-1.5">
                <Label>{l.name} <span className="text-xs text-muted-foreground">({fr ? "mois" : "months"} {l.months.join(", ")})</span></Label>
                <div className="flex items-center gap-2">
                  <Input className="h-9 w-32 text-right tabular" inputMode="decimal" defaultValue={((overrides.lumpSumScheduleCents[l.id] ?? l.amountCents) / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) set({ lumpSumScheduleCents: { ...overrides.lumpSumScheduleCents, [l.id]: c } }); }} aria-label={l.name} />
                  <span className="text-xs text-muted-foreground">{fr ? "par retrait" : "per withdrawal"}</span>
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Label>{fr ? "Un montant unique (impôt, cadeau…)" : "A one-time amount (tax refund, gift…)"}</Label>
              {overrides.lumpSums.map((l, i) => <Chip key={i} onRemove={() => set({ lumpSums: overrides.lumpSums.filter((_, j) => j !== i) })}>{l.month} · {l.label} · {money(l.cents)}</Chip>)}
              <div className="grid grid-cols-[auto_1fr_5rem_auto] gap-1.5 items-center">
                <input type="month" className="cell-input border-border" value={lumpMonth} min={startMonth} onChange={(e) => setLumpMonth(e.target.value)} aria-label="Month" />
                <Input className="h-9" placeholder={fr ? "Libellé" : "Label"} value={lumpLabel} onChange={(e) => setLumpLabel(e.target.value)} />
                <Input className="h-9 text-right" inputMode="decimal" placeholder="$" value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)} aria-label={t("common.amount")} />
                <Button size="icon" variant="soft" className="h-9 w-9" aria-label={t("common.add")} onClick={() => { const c = parseMoney(lumpAmount); if (c && lumpMonth) { set({ lumpSums: [...overrides.lumpSums, { month: lumpMonth, cents: c, label: lumpLabel || "Lump sum" }] }); setLumpAmount(""); } }}><Plus /></Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{fr ? "Si un taux change" : "If a rate changes"}</Label>
              {overrides.rateChanges.map((r, i) => <Chip key={i} onRemove={() => set({ rateChanges: overrides.rateChanges.filter((_, j) => j !== i) })}>{data.debts.find((d) => d.id === r.debtId)?.name} · {r.month} → {(r.annualRateBps / 100).toFixed(2)} %</Chip>)}
              <div className="grid grid-cols-[1fr_auto_4.5rem_auto] gap-1.5 items-center">
                <Select className="h-9" value={rateDebt} onChange={(e) => setRateDebt(e.target.value)} aria-label="Debt">{consumerDebts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                <input type="month" className="cell-input border-border" value={rateMonth} min={startMonth} onChange={(e) => setRateMonth(e.target.value)} aria-label="Month" />
                <Input className="h-9 text-right" inputMode="decimal" placeholder="%" value={ratePct} onChange={(e) => setRatePct(e.target.value)} aria-label="Rate" />
                <Button size="icon" variant="soft" className="h-9 w-9" aria-label={t("common.add")} onClick={() => { const p = Number(ratePct.replace(",", ".")); if (rateDebt && rateMonth && Number.isFinite(p)) { set({ rateChanges: [...overrides.rateChanges, { debtId: rateDebt, month: rateMonth, annualRateBps: Math.round(p * 100) }] }); setRatePct(""); } }}><Plus /></Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{fr ? "Couper une dépense" : "Cut an expense"} {cutFreed > 0 && <span className="text-xs text-good">· {fr ? "libère" : "frees"} {money(cutFreed)}{t("common.perMonth")}</span>} <How>{fr ? "Une coupe augmente le flux libre. Ajoutez le même montant en paiement supplémentaire pour l'envoyer à la dette." : "A cut raises free cash flow. Add the same amount as an extra payment to send it to debt."}</How></Label>
              {overrides.expenseCuts.map((c, i) => <Chip key={i} onRemove={() => set({ expenseCuts: overrides.expenseCuts.filter((_, j) => j !== i) })}>{c.expenseId ? data.expenses.find((e) => e.id === c.expenseId)?.name : c.category} · −{c.cents !== undefined ? money(c.cents) : `${c.pct} %`}</Chip>)}
              <div className="grid grid-cols-[1fr_auto_4rem_auto] gap-1.5 items-center">
                <Select className="h-9" value={cutTarget} onChange={(e) => setCutTarget(e.target.value)} aria-label="Target">
                  <option value="">{fr ? "Choisir…" : "Choose…"}</option>
                  <optgroup label={t("common.category")}>{categories.map((c) => <option key={`cat:${c}`} value={`cat:${c}`}>{c}</option>)}</optgroup>
                  <optgroup label={fr ? "Ligne" : "Line"}>{data.expenses.map((e) => <option key={e.id} value={`exp:${e.id}`}>{e.name}</option>)}</optgroup>
                </Select>
                <Select className="h-9 w-16" value={cutMode} onChange={(e) => setCutMode(e.target.value as "pct" | "cents")} aria-label="Mode"><option value="pct">%</option><option value="cents">$</option></Select>
                <Input className="h-9 text-right" inputMode="decimal" value={cutValue} onChange={(e) => setCutValue(e.target.value)} aria-label="Value" />
                <Button size="icon" variant="soft" className="h-9 w-9" aria-label={t("common.add")} disabled={!cutTarget} onClick={() => {
                  const sep = cutTarget.indexOf(":");
                  const kind = cutTarget.slice(0, sep);
                  const id = cutTarget.slice(sep + 1);
                  const cut = kind === "cat" ? { category: id } : { expenseId: id };
                  const v = cutMode === "pct" ? { pct: Number(cutValue) } : { cents: parseMoney(cutValue) ?? 0 };
                  set({ expenseCuts: [...overrides.expenseCuts, { ...cut, ...v }] });
                }}><Plus /></Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{fr ? "Mettre une épargne en pause pour rembourser" : "Pause a savings line to pay debt"} <How>{fr ? "La cotisation est suspendue N mois et le même montant est payé sur la dette. La projection des placements en tient compte." : "The contribution pauses for N months and the same amount is paid on the debt. The investment projection reflects it."}</How></Label>
              {overrides.redirects.map((r, i) => { const c = data.contributions.find((x) => x.id === r.contributionId); return <Chip key={i} onRemove={() => set({ redirects: overrides.redirects.filter((_, j) => j !== i) })}>{c ? `${accountName(c.accountId)} · ${money(toMonthlyCents(c.amountCents, c.frequency))}/m` : "?"} · {r.months} {t("common.months")}</Chip>; })}
              {savingsLines.length === 0 ? <p className="text-xs text-muted-foreground">{fr ? "Aucune ligne d'épargne dans le budget." : "No savings lines in the budget."}</p> : (
                <div className="grid grid-cols-[1fr_4rem_auto] gap-1.5 items-center">
                  <Select className="h-9" value={redirectId} onChange={(e) => setRedirectId(e.target.value)} aria-label="Contribution">
                    {savingsLines.map((c) => <option key={c.id} value={c.id}>{accountName(c.accountId)} · {money(toMonthlyCents(c.amountCents, c.frequency))}/m{c.incomeId ? (fr ? " (paie)" : " (payroll)") : ""}</option>)}
                  </Select>
                  <Input className="h-9 text-right" inputMode="numeric" value={redirectMonths} onChange={(e) => setRedirectMonths(e.target.value)} aria-label={t("common.months")} />
                  <Button size="icon" variant="soft" className="h-9 w-9" aria-label={t("common.add")} disabled={!redirectId} onClick={() => set({ redirects: [...overrides.redirects, { contributionId: redirectId, months: Math.max(1, Number(redirectMonths) || 12), startMonth }] })}><Plus /></Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{fr ? `Le fonds d'urgence (tampon de ${money(data.settings.cashBufferCents)}) n'est jamais envoyé à la dette.` : `The emergency fund (${money(data.settings.cashBufferCents)} buffer) is never sent to debt.`}</p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
