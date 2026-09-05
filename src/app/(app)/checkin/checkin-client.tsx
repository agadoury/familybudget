"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { Money } from "@/components/app/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { buildProjection } from "@/lib/projection";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import { monthKey, monthDiff, addMonths } from "@/lib/frequency";
import { parseMoney } from "@/lib/money";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";
import { generateInsights } from "@/lib/insights/rules";
import { saveCheckin } from "@/lib/actions/checkin";
import { asHousehold } from "../payoff/use-projection";

const STEPS = ["debts", "investments", "spend", "lumps", "review"] as const;

export function CheckinClient({ data, baselineOverrides, snapshots }: { data: HouseholdDTO; baselineOverrides: ScenarioOverrides | null; snapshots: SnapshotDTO[] }) {
  const { t, money, month: fm, lang, pct, personName } = useApp();
  const router = useRouter();
  const nowKey = monthKey(new Date());
  const [month, setMonth] = React.useState(nowKey);
  const [step, setStep] = React.useState(0);
  const overrides = baselineOverrides ?? EMPTY_OVERRIDES;
  const consumerDebts = data.debts.filter((d) => d.includeInPayoff);
  const otherDebts = data.debts.filter((d) => !d.includeInPayoff && d.type !== "LEASE");
  const leaves = data.accounts.filter((a) => !data.accounts.some((c) => c.parentId === a.id));
  const flexCats = [...new Set(data.expenses.filter((e) => e.type === "FLEXIBLE").map((e) => e.category))];
  const budgetFor = (cat: string) => data.expenses.filter((e) => e.category === cat).reduce((s, e) => s + Math.round((e.amountCents * (e.frequency === "MONTHLY" ? 12 : e.frequency === "SEMI_MONTHLY" ? 24 : e.frequency === "BI_WEEKLY" ? 26 : e.frequency === "WEEKLY" ? 52 : e.frequency === "QUARTERLY" ? 4 : e.frequency === "ANNUAL" ? 1 : 0)) / 12), 0);

  const [debtBal, setDebtBal] = React.useState<Record<string, number>>(Object.fromEntries(data.debts.map((d) => [d.id, d.balanceCents])));
  const [acctBal, setAcctBal] = React.useState<Record<string, number>>(Object.fromEntries(leaves.map((a) => [a.id, a.balanceCents])));
  const [spend, setSpend] = React.useState<Record<string, number>>(Object.fromEntries(flexCats.map((c) => [c, budgetFor(c)])));
  const [lumps, setLumps] = React.useState<{ debtId: string; amountCents: number; note: string; bonusId?: string }[]>([]);
  const [note, setNote] = React.useState("");
  const [pending, start] = React.useTransition();
  const [saved, setSaved] = React.useState(false);

  // Projection after the check-in (balances as entered)
  const after = React.useMemo(() => {
    const d = asHousehold({
      ...data,
      debts: data.debts.map((x) => ({ ...x, balanceCents: debtBal[x.id] ?? x.balanceCents })),
      accounts: data.accounts.map((a) => ({ ...a, balanceCents: acctBal[a.id] ?? a.balanceCents })),
    });
    return buildProjection(d, { startMonth: month, overrides });
  }, [data, debtBal, acctBal, month, overrides]);

  // Plan for this month, projected from the previous check-in's balances (if any).
  const prev = [...snapshots].filter((s) => s.month < month && s.debts.length > 0).pop();
  const plan = React.useMemo(() => {
    if (!prev) return null;
    const d = asHousehold({ ...data, debts: data.debts.map((x) => ({ ...x, balanceCents: prev.debts.find((p) => p.debtId === x.id)?.balanceCents ?? x.balanceCents })) });
    const proj = buildProjection(d, { startMonth: prev.month, overrides, horizonMonths: Math.max(2, monthDiff(prev.month, month) + 1) });
    const idx = Math.min(monthDiff(prev.month, month), proj.payoff.months.length - 1);
    return { consumerCents: proj.payoff.months[idx]?.consumerBalanceCents ?? null, month: prev.month };
  }, [prev, data, month, overrides]);
  const actualConsumer = consumerDebts.reduce((s, d) => s + (debtBal[d.id] ?? 0), 0);
  const delta = plan?.consumerCents !== null && plan?.consumerCents !== undefined ? actualConsumer - plan.consumerCents : null;
  const drift = prev?.projectedPayoffMonth && after.payoff.outcome.kind === "paid" ? monthDiff(after.payoff.outcome.month, prev.projectedPayoffMonth) : null;
  const overspend = flexCats.map((c) => ({ c, diff: (spend[c] ?? 0) - budgetFor(c) })).filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const suggestion = (() => {
    const ins = generateInsights({ ...data, debts: data.debts.map((x) => ({ ...x, balanceCents: debtBal[x.id] ?? x.balanceCents })) }, after, snapshots, { money, pct, month: fm, lang, personName });
    if (overspend && overspend.diff > 5000) return lang === "fr" ? `${overspend.c} dépasse le budget de ${money(overspend.diff)} ce mois-ci ; c'est le premier poste à ramener au budget.` : `${overspend.c} is ${money(overspend.diff)} over budget this month; it is the first line to bring back to budget.`;
    return ins[0]?.text ?? (lang === "fr" ? "Rien à signaler ce mois-ci." : "Nothing to flag this month.");
  })();

  const monthOptions = Array.from({ length: 6 }, (_, i) => addMonths(nowKey, -i));
  const StepHeader = () => (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEPS.map((s, i) => <li key={s} className={`px-2 py-1 rounded ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-good-bg text-good" : "bg-muted text-muted-foreground"}`}>{i + 1}. {stepLabel(s)}</li>)}
    </ol>
  );
  const stepLabel = (s: (typeof STEPS)[number]) => ({
    debts: lang === "fr" ? "Dettes" : "Debts", investments: lang === "fr" ? "Placements" : "Investments", spend: lang === "fr" ? "Dépenses variables" : "Flexible spend", lumps: lang === "fr" ? "Montants reçus" : "Lump sums", review: lang === "fr" ? "Bilan" : "Review",
  })[s];

  function submit() {
    start(async () => {
      const res = await saveCheckin({
        month,
        note: note || null,
        debts: data.debts.filter((d) => d.type !== "LEASE").map((d) => ({ debtId: d.id, balanceCents: debtBal[d.id] ?? d.balanceCents })),
        accounts: leaves.map((a) => ({ accountId: a.id, balanceCents: acctBal[a.id] ?? a.balanceCents })),
        spend: flexCats.map((c) => ({ category: c, amountCents: spend[c] ?? 0 })),
        lumpSums: lumps.filter((l) => l.amountCents > 0).map((l) => ({ debtId: l.debtId, amountCents: l.amountCents, note: l.note || undefined, bonusId: l.bonusId })),
        projectedPayoffMonth: after.payoff.outcome.kind === "paid" ? after.payoff.outcome.month : null,
        projectedInterestCents: after.payoff.consumerInterestCents,
        netWorthCents: after.currentNetWorthCents,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setSaved(true);
      router.refresh();
    });
  }

  const MoneyInput = ({ value, onChange, label }: { value: number; onChange: (c: number) => void; label: string }) => (
    <Input className="text-right tabular h-10 text-base" inputMode="decimal" aria-label={label} defaultValue={(value / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) onChange(c); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">{t("checkin.title")}</h1>
        <Select className="w-auto h-8" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">{monthOptions.map((m) => <option key={m} value={m}>{fm(m)}</option>)}</Select>
      </div>
      <StepHeader />

      {step === 0 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Soldes réels des dettes aujourd'hui" : "Actual debt balances today"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...consumerDebts, ...otherDebts].map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_10rem] items-center gap-2">
                <Label>{d.name}<span className="block text-xs text-muted-foreground">{lang === "fr" ? "avant" : "was"} {money(d.balanceCents)} · {d.balanceAsOf}</span></Label>
                <MoneyInput value={debtBal[d.id]} onChange={(c) => setDebtBal((s) => ({ ...s, [d.id]: c }))} label={d.name} />
              </div>
            ))}
          </CardContent></Card>
      )}
      {step === 1 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Soldes des placements" : "Investment balances"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {leaves.map((a) => (
              <div key={a.id} className="grid grid-cols-[1fr_10rem] items-center gap-2">
                <Label>{personName(a.owner)} · {a.name}<span className="block text-xs text-muted-foreground">{lang === "fr" ? "avant" : "was"} {money(a.balanceCents)} · {a.balanceAsOf}</span></Label>
                <MoneyInput value={acctBal[a.id]} onChange={(c) => setAcctBal((s) => ({ ...s, [a.id]: c }))} label={a.name} />
              </div>
            ))}
          </CardContent></Card>
      )}
      {step === 2 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Dépenses variables réelles du mois" : "Actual flexible spend this month"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {flexCats.map((c) => (
              <div key={c} className="grid grid-cols-[1fr_10rem] items-center gap-2">
                <Label>{c}<span className="block text-xs text-muted-foreground">{lang === "fr" ? "budget" : "budget"} {money(budgetFor(c))}</span></Label>
                <MoneyInput value={spend[c]} onChange={(v) => setSpend((s) => ({ ...s, [c]: v }))} label={c} />
              </div>
            ))}
            <div className="text-sm border-t pt-2 flex justify-between"><span>{t("common.total")}</span><span><Money cents={flexCats.reduce((s, c) => s + (spend[c] ?? 0), 0)} /> / <Money cents={flexCats.reduce((s, c) => s + budgetFor(c), 0)} /></span></div>
          </CardContent></Card>
      )}
      {step === 3 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Montants forfaitaires reçus et appliqués à une dette" : "Lump sums received and applied to a debt"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{lang === "fr" ? "Boni, retrait du régime d'actions, remboursement d'impôt. Le solde saisi à l'étape 1 est la référence ; ceci sert à l'historique et à confirmer un boni." : "Bonus, stock-plan withdrawal, tax refund. The balance entered in step 1 is authoritative; this is for the record and to confirm a bonus."}</p>
            {lumps.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_8rem_auto] gap-2 items-center">
                <Select value={l.debtId} onChange={(e) => setLumps((ls) => ls.map((x, j) => (j === i ? { ...x, debtId: e.target.value } : x)))}>{consumerDebts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                <Input value={l.note} placeholder={lang === "fr" ? "Libellé" : "Label"} onChange={(e) => setLumps((ls) => ls.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                <MoneyInput value={l.amountCents} onChange={(c) => setLumps((ls) => ls.map((x, j) => (j === i ? { ...x, amountCents: c } : x)))} label="Amount" />
                <Button variant="ghost" size="sm" onClick={() => setLumps((ls) => ls.filter((_, j) => j !== i))}>✕</Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setLumps((ls) => [...ls, { debtId: consumerDebts[0]?.id ?? "", amountCents: 0, note: lang === "fr" ? "Retrait régime d'actions" : "Stock plan withdrawal" }])}>+ {lang === "fr" ? "Retrait régime d'actions" : "Stock plan withdrawal"}</Button>
              {data.bonuses.filter((b) => b.confidence === "UNCONFIRMED" && b.amountCents > 0 && !lumps.some((l) => l.bonusId === b.id)).map((b) => (
                <Button key={b.id} variant="outline" size="sm" onClick={() => setLumps((ls) => [...ls, { debtId: consumerDebts[0]?.id ?? "", amountCents: Math.round((b.amountCents * b.pctAppliedBps) / 10_000), note: `${personName(b.person)} bonus`, bonusId: b.id }])}>+ {personName(b.person)} {lang === "fr" ? "boni reçu" : "bonus received"}</Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLumps((ls) => [...ls, { debtId: consumerDebts[0]?.id ?? "", amountCents: 0, note: "" }])}>+ {lang === "fr" ? "Autre" : "Other"}</Button>
            </div>
            <div className="space-y-1 pt-2"><Label>{lang === "fr" ? "Quelque chose d'inhabituel ?" : "Anything unusual?"}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </CardContent></Card>
      )}
      {step === 4 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Bilan" : "Review"} — {fm(month)}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-muted-foreground">{t("payoff.planVsActual")}</div>
                {delta === null ? <div className="text-muted-foreground">{lang === "fr" ? "Premier bilan — pas de plan antérieur." : "First check-in — no earlier plan to compare."}</div> : (
                  <div className={`font-semibold tabular ${delta > 0 ? "text-act" : "text-good"}`}>{delta > 0 ? "▼ " : "▲ "}{money(Math.abs(delta), { compact: true })} {delta > 0 ? (lang === "fr" ? "de plus que prévu" : "more debt than planned") : (lang === "fr" ? "de moins que prévu" : "less debt than planned")}<div className="text-xs font-normal text-muted-foreground">{lang === "fr" ? "vs plan depuis" : "vs plan from"} {fm(plan!.month)}</div></div>
                )}
              </div>
              <div><div className="text-xs text-muted-foreground">{t("dash.debtFree")}</div>
                <div className="font-semibold">{after.payoff.outcome.kind === "paid" ? fm(after.payoff.outcome.month) : t("common.never")}</div>
                {drift !== null && <Badge variant={drift > 0 ? "good" : drift < 0 ? "act" : "default"}>{drift > 0 ? `▲ ${drift} ${t("dash.monthsAhead")}` : drift < 0 ? `▼ ${-drift} ${t("dash.monthsBehind")}` : t("dash.onPlan")}</Badge>}
              </div>
              <div><div className="text-xs text-muted-foreground">{t("dash.netWorth")}</div><div className="font-semibold tabular">{money(after.currentNetWorthCents, { compact: true })}</div></div>
              <div><div className="text-xs text-muted-foreground">{t("dash.consumerDebt")}</div><div className="font-semibold tabular">{money(actualConsumer, { compact: true })}</div></div>
            </div>
            <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground mb-1">{lang === "fr" ? "Une suggestion" : "One suggestion"}</div>{suggestion}</div>
            {saved ? <Badge variant="good"><Check className="h-3 w-3" /> {t("common.saved")}</Badge> : <Button onClick={submit} disabled={pending} className="w-full h-11">{lang === "fr" ? "Enregistrer le bilan" : "Save check-in"}</Button>}
          </CardContent></Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft /> {lang === "fr" ? "Précédent" : "Back"}</Button>
        {step < STEPS.length - 1 && <Button onClick={() => setStep((s) => s + 1)}>{lang === "fr" ? "Suivant" : "Next"} <ArrowRight /></Button>}
      </div>

      {snapshots.length > 0 && (
        <Card><CardHeader><CardTitle>{lang === "fr" ? "Bilans précédents" : "Previous check-ins"}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {[...snapshots].reverse().slice(0, 12).map((s) => (
              <div key={s.id} className="flex justify-between border-b last:border-0 py-1">
                <span>{fm(s.month)}{s.note ? <span className="text-muted-foreground"> — {s.note}</span> : null}</span>
                <span className="tabular">{money(s.debts.filter((d) => consumerDebts.some((c) => c.id === d.debtId)).reduce((a, d) => a + d.balanceCents, 0), { compact: true })}{s.projectedPayoffMonth ? <span className="text-muted-foreground"> · {t("dash.debtFree")} {fm(s.projectedPayoffMonth)}</span> : null}</span>
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}
