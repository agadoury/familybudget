"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/app/money";
import { parseMoney } from "@/lib/money";
import type { HouseholdDTO } from "@/lib/dto-household";
import type { DebtInputForm } from "@/lib/schemas";
import { addDebtPayment, addDebtRate, createDebt, deleteDebt, deleteDebtRate, deleteLumpSumSchedule, updateDebt, upsertLumpSumSchedule } from "@/lib/actions/debts";

type DebtRow = HouseholdDTO["debts"][number];
const TYPES = ["LOC", "CREDIT_CARD", "CAR_LOAN", "LEASE", "MORTGAGE", "OTHER"] as const;
const today = () => new Date().toISOString().slice(0, 10);

function toForm(d: DebtRow | null): DebtInputForm {
  const rate = d ? [...d.rates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)).filter((r) => r.effectiveDate <= today()).pop() ?? d.rates[0] : null;
  return {
    name: d?.name ?? "", type: d?.type ?? "CREDIT_CARD", balanceCents: d?.balanceCents ?? 0, balanceAsOf: d?.balanceAsOf ?? today(), priority: d?.priority ?? 100,
    minimumType: d?.minimumType ?? "PERCENT_OF_BALANCE", minimumCents: d?.minimumCents ?? 0, minimumBps: d?.minimumBps ?? 500, minimumFloorCents: d?.minimumFloorCents ?? 1000,
    plannedExtraCents: d?.plannedExtraCents ?? 0, endDate: d?.endDate ?? null, amortizationMonths: d?.amortizationMonths ?? null, renewalDate: d?.renewalDate ?? null,
    includeInPayoff: d?.includeInPayoff ?? true, includeInNetWorth: d?.includeInNetWorth ?? true, notes: d?.notes ?? null,
    annualRateBps: rate?.annualRateBps ?? 2000, rateEffectiveDate: undefined,
  };
}

export function DebtsPanel({ data }: { data: HouseholdDTO }) {
  const { t, money, pct, lang } = useApp();
  const router = useRouter();
  const [editing, setEditing] = React.useState<DebtRow | null | "new">(null);
  const [form, setForm] = React.useState<DebtInputForm>(toForm(null));
  const [payDebt, setPayDebt] = React.useState<DebtRow | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [payDate, setPayDate] = React.useState(today());
  const [payType, setPayType] = React.useState<"MINIMUM" | "EXTRA" | "LUMP_SUM">("EXTRA");
  const [newRate, setNewRate] = React.useState({ date: today(), pct: "" });
  const [pending, start] = React.useTransition();
  const typeLabel: Record<(typeof TYPES)[number], string> = lang === "fr"
    ? { LOC: "Marge de crédit", CREDIT_CARD: "Carte de crédit", CAR_LOAN: "Prêt auto", LEASE: "Location auto", MORTGAGE: "Hypothèque", OTHER: "Autre" }
    : { LOC: "Line of credit", CREDIT_CARD: "Credit card", CAR_LOAN: "Car loan", LEASE: "Car lease", MORTGAGE: "Mortgage", OTHER: "Other" };

  const open = (d: DebtRow | "new") => { setEditing(d); setForm(toForm(d === "new" ? null : d)); };
  const f = <K extends keyof DebtInputForm>(k: K, v: DebtInputForm[K]) => setForm((s) => ({ ...s, [k]: v }));

  function save() {
    start(async () => {
      const res = editing === "new" ? await createDebt(form) : editing ? await updateDebt(editing.id, form) : null;
      if (!res) return;
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      setEditing(null);
      router.refresh();
    });
  }

  const currentRate = (d: DebtRow) => [...d.rates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)).filter((r) => r.effectiveDate <= today()).pop()?.annualRateBps ?? d.rates[0]?.annualRateBps ?? 0;

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{lang === "fr" ? "Tous les paiements de dettes vivent ici (jamais dans les dépenses fixes)." : "All debt payments live here (never as fixed expenses)."}</p>
          <Button size="sm" variant="outline" onClick={() => open("new")}><Plus /> {lang === "fr" ? "Ajouter une dette" : "Add a debt"}</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>{t("common.name")}</TableHead><TableHead>{t("common.type")}</TableHead><TableHead className="text-right">{t("common.balance")}</TableHead><TableHead className="text-right">{t("common.rate")}</TableHead><TableHead>{lang === "fr" ? "Minimum" : "Minimum"}</TableHead><TableHead>{lang === "fr" ? "Priorité" : "Priority"}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.debts.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name} {d.notes?.toLowerCase().startsWith("estimate") && <Badge variant="watch">{t("common.estimate")}</Badge>} {!d.includeInPayoff && <Badge>{lang === "fr" ? "hors remboursement" : "not in payoff"}</Badge>}</TableCell>
                <TableCell>{typeLabel[d.type]}</TableCell>
                <TableCell className="text-right">{d.type === "LEASE" ? "—" : <Money cents={d.balanceCents} />}<div className="text-[10px] text-muted-foreground">{d.balanceAsOf}</div></TableCell>
                <TableCell className="text-right">{d.type === "LEASE" ? "—" : pct(currentRate(d))}{d.rates.length > 1 && <div className="text-[10px] text-muted-foreground">{d.rates.length} {lang === "fr" ? "taux" : "rates"}</div>}</TableCell>
                <TableCell className="text-xs">{d.minimumType === "FIXED" ? money(d.minimumCents) : d.minimumType === "PERCENT_OF_BALANCE" ? `${(d.minimumBps / 100).toFixed(1)} % (min ${money(d.minimumFloorCents, { compact: true })})` : lang === "fr" ? "intérêts seulement" : "interest-only"}{d.endDate ? ` · ${lang === "fr" ? "fin" : "ends"} ${d.endDate.slice(0, 7)}` : ""}</TableCell>
                <TableCell>{d.priority}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {d.type !== "LEASE" && <Button size="sm" variant="ghost" onClick={() => { setPayDebt(d); setPayAmount(""); }}>{lang === "fr" ? "Paiement" : "Log payment"}</Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" onClick={() => open(d)}><Pencil /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Lump-sum schedules */}
        <div className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{lang === "fr" ? "Montants forfaitaires récurrents" : "Recurring lump sums"}</h3>
            <Button size="sm" variant="ghost" onClick={() => start(async () => { const r = await upsertLumpSumSchedule(null, { name: lang === "fr" ? "Nouveau" : "New", amountCents: 0, months: [4, 11], startDate: today(), active: true }); if (r.ok) router.refresh(); else toast.error(r.error); })}><Plus /> {t("common.add")}</Button></div>
          {data.lumpSumSchedules.map((l) => (
            <div key={l.id} className="grid gap-2 md:grid-cols-[1fr_8rem_1fr_auto_auto] items-center border rounded-md p-2 text-sm">
              <Input className="h-8" defaultValue={l.name} aria-label={t("common.name")} onBlur={(e) => e.target.value !== l.name && start(async () => { const r = await upsertLumpSumSchedule(l.id, { ...l, name: e.target.value }); if (!r.ok) toast.error(r.error); else router.refresh(); })} />
              <Input className="h-8 text-right tabular" inputMode="decimal" defaultValue={(l.amountCents / 100).toFixed(2)} aria-label={t("common.amount")} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== l.amountCents) start(async () => { const r = await upsertLumpSumSchedule(l.id, { ...l, amountCents: c }); if (!r.ok) toast.error(r.error); else router.refresh(); }); }} />
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <button key={m} className={`h-7 w-7 rounded text-xs border ${l.months.includes(m) ? "bg-primary text-primary-foreground" : "bg-card"}`} aria-pressed={l.months.includes(m)} onClick={() => start(async () => { const months = l.months.includes(m) ? l.months.filter((x) => x !== m) : [...l.months, m].sort((a, b) => a - b); if (months.length === 0) return; const r = await upsertLumpSumSchedule(l.id, { ...l, months }); if (!r.ok) toast.error(r.error); else router.refresh(); })}>{m}</button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-xs"><Switch checked={l.active} onCheckedChange={(v) => start(async () => { const r = await upsertLumpSumSchedule(l.id, { ...l, active: v }); if (!r.ok) toast.error(r.error); else router.refresh(); })} /> {lang === "fr" ? "actif" : "active"}</label>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-act" aria-label={t("common.delete")} onClick={() => start(async () => { const r = await deleteLumpSumSchedule(l.id); if (!r.ok) toast.error(r.error); else router.refresh(); })}><Trash2 /></Button>
            </div>
          ))}
        </div>

        {/* Edit drawer */}
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent title={editing === "new" ? (lang === "fr" ? "Nouvelle dette" : "New debt") : form.name}>
            <div className="space-y-3 text-sm">
              <Field label={t("common.name")}><Input value={form.name} onChange={(e) => f("name", e.target.value)} /></Field>
              <Field label={t("common.type")}><Select value={form.type} onChange={(e) => f("type", e.target.value as DebtInputForm["type"])}>{TYPES.map((x) => <option key={x} value={x}>{typeLabel[x]}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("common.balance")}><Input inputMode="decimal" defaultValue={(form.balanceCents / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) f("balanceCents", c); }} /></Field>
                <Field label={t("common.asOf")}><Input type="date" value={form.balanceAsOf} onChange={(e) => f("balanceAsOf", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`${t("common.rate")} (%)`}><Input inputMode="decimal" defaultValue={(form.annualRateBps / 100).toFixed(2)} onBlur={(e) => { const p = Number(e.target.value.replace(",", ".")); if (Number.isFinite(p)) f("annualRateBps", Math.round(p * 100)); }} /></Field>
                <Field label={lang === "fr" ? "Taux en vigueur le" : "Rate effective"}><Input type="date" value={form.rateEffectiveDate ?? ""} onChange={(e) => f("rateEffectiveDate", e.target.value || undefined)} /></Field>
              </div>
              <Field label={lang === "fr" ? "Paiement minimum" : "Minimum payment"}>
                <Select value={form.minimumType} onChange={(e) => f("minimumType", e.target.value as DebtInputForm["minimumType"])}>
                  <option value="FIXED">{lang === "fr" ? "Montant fixe" : "Fixed amount"}</option>
                  <option value="PERCENT_OF_BALANCE">{lang === "fr" ? "% du solde" : "% of balance"}</option>
                  <option value="INTEREST_ONLY">{lang === "fr" ? "Intérêts seulement" : "Interest only"}</option>
                </Select>
              </Field>
              {form.minimumType === "FIXED" && <Field label={t("common.amount")}><Input inputMode="decimal" defaultValue={(form.minimumCents / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) f("minimumCents", c); }} /></Field>}
              {form.minimumType === "PERCENT_OF_BALANCE" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="%"><Input inputMode="decimal" defaultValue={(form.minimumBps / 100).toFixed(1)} onBlur={(e) => { const p = Number(e.target.value.replace(",", ".")); if (Number.isFinite(p)) f("minimumBps", Math.round(p * 100)); }} /></Field>
                  <Field label={lang === "fr" ? "Plancher" : "Floor"}><Input inputMode="decimal" defaultValue={(form.minimumFloorCents / 100).toFixed(2)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) f("minimumFloorCents", c); }} /></Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label={lang === "fr" ? "Priorité (1 = d'abord)" : "Priority (1 = first)"}><Input inputMode="numeric" value={form.priority} onChange={(e) => f("priority", Number(e.target.value) || 0)} /></Field>
                <Field label={lang === "fr" ? "Fin des paiements" : "Payments end"}><Input type="date" value={form.endDate ?? ""} onChange={(e) => f("endDate", e.target.value || null)} /></Field>
              </div>
              {form.type === "MORTGAGE" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={lang === "fr" ? "Amortissement (mois)" : "Amortization (months)"}><Input inputMode="numeric" value={form.amortizationMonths ?? ""} onChange={(e) => f("amortizationMonths", e.target.value ? Number(e.target.value) : null)} /></Field>
                  <Field label={lang === "fr" ? "Renouvellement" : "Renewal"}><Input type="date" value={form.renewalDate ?? ""} onChange={(e) => f("renewalDate", e.target.value || null)} /></Field>
                </div>
              )}
              <label className="flex items-center justify-between"><span>{lang === "fr" ? "Reçoit les paiements supplémentaires (dette à la consommation)" : "Receives extra payments (consumer debt)"}</span><Switch checked={form.includeInPayoff} onCheckedChange={(v) => f("includeInPayoff", v)} /></label>
              <label className="flex items-center justify-between"><span>{lang === "fr" ? "Compte dans la valeur nette" : "Counts in net worth"}</span><Switch checked={form.includeInNetWorth} onCheckedChange={(v) => f("includeInNetWorth", v)} /></label>
              <Field label={t("common.notes")}><Input value={form.notes ?? ""} onChange={(e) => f("notes", e.target.value || null)} /></Field>

              {editing && editing !== "new" && (
                <div className="space-y-1 border-t pt-3">
                  <div className="text-xs font-medium">{lang === "fr" ? "Historique des taux" : "Rate history"}</div>
                  {editing.rates.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span>{r.effectiveDate} → {(r.annualRateBps / 100).toFixed(2)} %</span>
                      <button className="text-muted-foreground hover:text-act" aria-label={t("common.delete")} onClick={() => start(async () => { const x = await deleteDebtRate(r.id); if (!x.ok) toast.error(x.error); else { router.refresh(); setEditing(null); } })}><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <div className="flex gap-1 items-center">
                    <Input type="date" className="h-8" value={newRate.date} onChange={(e) => setNewRate({ ...newRate, date: e.target.value })} />
                    <Input className="h-8 w-20 text-right" inputMode="decimal" placeholder="%" value={newRate.pct} onChange={(e) => setNewRate({ ...newRate, pct: e.target.value })} />
                    <Button size="sm" variant="outline" onClick={() => start(async () => { const p = Number(newRate.pct.replace(",", ".")); if (!Number.isFinite(p)) return; const x = await addDebtRate({ debtId: editing.id, effectiveDate: newRate.date, annualRateBps: Math.round(p * 100) }); if (!x.ok) toast.error(x.error); else { router.refresh(); setEditing(null); } })}>{t("common.add")}</Button>
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-2">
                {editing && editing !== "new" ? <Button variant="ghost" className="text-act" disabled={pending} onClick={() => start(async () => { const r = await deleteDebt(editing.id); if (!r.ok) toast.error(r.error); else { setEditing(null); router.refresh(); } })}>{t("common.delete")}</Button> : <span />}
                <Button disabled={pending} onClick={save}>{t("common.save")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Log payment drawer */}
        <Dialog open={!!payDebt} onOpenChange={(o) => !o && setPayDebt(null)}>
          <DialogContent title={`${lang === "fr" ? "Paiement" : "Payment"} — ${payDebt?.name ?? ""}`} description={lang === "fr" ? "Le solde est réduit du montant ; l'historique est conservé." : "The balance is reduced by the amount; the history is kept."}>
            <div className="space-y-3 text-sm">
              <Field label={t("common.amount")}><Input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus /></Field>
              <Field label={t("common.date")}><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
              <Field label={t("common.type")}><Select value={payType} onChange={(e) => setPayType(e.target.value as typeof payType)}><option value="MINIMUM">minimum</option><option value="EXTRA">extra</option><option value="LUMP_SUM">lump sum</option></Select></Field>
              <Button disabled={pending} onClick={() => start(async () => { const c = parseMoney(payAmount); if (!payDebt || !c) return; const r = await addDebtPayment({ debtId: payDebt.id, date: payDate, amountCents: c, type: payType }); if (!r.ok) toast.error(r.error); else { toast.success(t("common.saved")); setPayDebt(null); router.refresh(); } })}>{t("common.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
