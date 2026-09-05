"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Download, Upload, ArrowDownToLine, CreditCard, Home, ShoppingBag, PiggyBank, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { MoneyCell, TextCell } from "@/components/app/inline";
import { useOptimisticRows } from "@/components/app/use-optimistic-rows";
import { PageHeader, Section, ListRow, BigStat, EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREQUENCIES, monthKey, toMonthlyCents, type Frequency } from "@/lib/frequency";
import { computeBudget } from "@/lib/budget/compute";
import { parseMoney } from "@/lib/money";
import type { AccountDTO, ContributionDTO, ExpenseDTO, IncomeDTO } from "@/lib/dto";
import {
  createContribution, createExpense, createIncome, deleteContribution, deleteExpense, deleteIncome,
  updateContribution, updateExpense, updateIncome,
} from "@/lib/actions/budget";
import { importBudgetCsv } from "@/lib/actions/csv";

type DebtLite = { id: string; name: string; type: string; balanceCents: number; scheduledCents: number; currentRateBps: number; minimumType: string };
const DESTINATIONS = ["SPENDING_ACCOUNT", "RRSP", "STOCK_PLAN", "TFSA", "DEBT_PAYDOWN", "OTHER"] as const;
const today = () => new Date().toISOString().slice(0, 10);

type Drawer =
  | { kind: "income"; row: IncomeDTO | null }
  | { kind: "expense"; row: ExpenseDTO | null; type: "FIXED" | "FLEXIBLE" | "SAVINGS" }
  | { kind: "contribution"; row: ContributionDTO | null }
  | null;

export function BudgetTable(props: { incomes: IncomeDTO[]; expenses: ExpenseDTO[]; contributions: ContributionDTO[]; accounts: AccountDTO[]; debts: DebtLite[] }) {
  const { t, money, pct, personName, lang } = useApp();
  const fr = lang === "fr";
  const router = useRouter();
  const labels = React.useMemo(() => ({ saved: t("common.saved"), deleted: t("common.deleted"), undo: t("common.undo") }), [t]);
  const inc = useOptimisticRows(props.incomes, labels);
  const exp = useOptimisticRows(props.expenses, labels);
  const con = useOptimisticRows(props.contributions, labels);
  const [drawer, setDrawer] = React.useState<Drawer>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("");
  const [essentialOnly, setEssentialOnly] = React.useState(false);
  const [cutPct, setCutPct] = React.useState(10);

  const freqLabel = (f: Frequency) => t(`freq.${f}` as const);
  const destLabel: Record<(typeof DESTINATIONS)[number], string> = fr
    ? { SPENDING_ACCOUNT: "Compte courant", RRSP: "REER", STOCK_PLAN: "Régime d'actions", TFSA: "CELI", DEBT_PAYDOWN: "Remboursement de dette", OTHER: "Autre" }
    : { SPENDING_ACCOUNT: "Spending account", RRSP: "RRSP", STOCK_PLAN: "Stock plan", TFSA: "TFSA", DEBT_PAYDOWN: "Debt paydown", OTHER: "Other" };

  const m = monthKey(new Date());
  const summary = computeBudget(m, inc.rows, exp.rows, con.rows);
  const debtMin = props.debts.reduce((s, d) => s + d.scheduledCents, 0);
  const committed = summary.fixedCents + summary.savingsCents + debtMin;
  const fcf = summary.inflowCents - committed - summary.flexibleCents;
  const categories = [...new Set(exp.rows.map((e) => e.category))].sort();
  const filtersActive = !!(categoryFilter || ownerFilter || essentialOnly);
  const visibleExpenses = exp.rows.filter((e) => (!categoryFilter || e.category === categoryFilter) && (!ownerFilter || e.owner === ownerFilter) && (!essentialOnly || e.essential));
  const accountName = (id: string) => {
    const a = props.accounts.find((x) => x.id === id);
    if (!a) return "?";
    const parent = a.parentId ? props.accounts.find((x) => x.id === a.parentId) : null;
    return `${personName(a.owner)} · ${parent ? `${parent.name} › ` : ""}${a.name}`;
  };
  const leafAccounts = props.accounts.filter((a) => !props.accounts.some((c) => c.parentId === a.id));
  const pctOf = (cents: number) => (summary.inflowCents > 0 ? Math.round((cents / summary.inflowCents) * 100) : 0);

  async function onImport(file: File) {
    const res = await importBudgetCsv(await file.text());
    if (res.ok) { toast.success(`${res.data.created} ${fr ? "créées" : "created"}, ${res.data.updated} ${fr ? "mises à jour" : "updated"}`); router.refresh(); } else toast.error(res.error);
  }

  // Where the money goes bar
  const segments = [
    { key: "fixed", label: t("budget.fixed"), cents: summary.fixedCents, color: "bg-chart-1" },
    { key: "debt", label: fr ? "Dettes" : "Debt", cents: debtMin, color: "bg-chart-4" },
    { key: "savings", label: fr ? "Épargne" : "Savings", cents: summary.savingsCents, color: "bg-chart-3" },
    { key: "flex", label: t("budget.flexible"), cents: summary.flexibleCents, color: "bg-chart-2" },
    { key: "left", label: fr ? "Reste" : "Left over", cents: Math.max(0, fcf), color: "bg-good" },
  ];
  const barTotal = Math.max(summary.inflowCents, committed + summary.flexibleCents);

  const sentence = fcf < 0
    ? fr ? <>Il sort <strong className="text-act">{money(-fcf)}</strong> de plus qu’il n’entre chaque mois. La marge de crédit absorbe la différence.</> : <>You spend <strong className="text-act">{money(-fcf)}</strong> more than comes in each month. The line of credit absorbs the difference.</>
    : fr ? <>Il reste <strong className="text-good">{money(fcf)}</strong> chaque mois une fois tout payé.</> : <>You have <strong className="text-good">{money(fcf)}</strong> left each month after everything is paid.</>;

  const expenseRow = (r: ExpenseDTO) => (
    <ListRow
      key={r.id}
      primary={<TextCell value={r.name} onCommit={(v) => exp.patch(r.id, { name: v }, updateExpense)} ariaLabel={t("common.name")} className="-ml-2 font-medium" />}
      mobilePrimary={r.name}
      mobileValue={money(r.amountCents)}
      secondary={<span className="flex items-center gap-1.5 flex-wrap">{r.category}{r.owner !== "SHARED" && <> · {personName(r.owner)}</>}{r.essential && <> · {t("common.essential")}</>}{r.notes?.toLowerCase().startsWith("estimate") && <Badge variant="watch">{t("common.estimate")}</Badge>}</span>}
      value={<MoneyCell cents={r.amountCents} onCommit={(v) => exp.patch(r.id, { amountCents: v }, updateExpense)} ariaLabel={t("common.amount")} className="w-28 font-semibold" />}
      valueSub={r.frequency === "MONTHLY" ? (fr ? "par mois" : "per month") : <>{freqLabel(r.frequency)}<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>≈ {money(toMonthlyCents(r.amountCents, r.frequency), { compact: true })}{t("common.perMonth")}</>}
      onClick={() => setDrawer({ kind: "expense", row: r, type: r.type })}
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("budget.title")}
        subtitle={fr ? "Ce qui entre et ce qui sort, chaque mois." : "What comes in and what goes out, every month."}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><a href="/api/budget/csv" download><Download /> CSV</a></Button>
            <label className="inline-flex">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
              <span className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border bg-card text-xs font-medium cursor-pointer hover:bg-accent"><Upload className="h-4 w-4" /> {t("budget.importCsv")}</span>
            </label>
          </>
        }
      />

      {/* Glance */}
      <Card>
        <CardContent className="p-5 md:p-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <BigStat label={t("dash.freeCashFlow")} value={money(fcf, { sign: true })} tone={fcf < 0 ? "act" : "good"} sub={sentence} />
            <div>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                {segments.filter((s) => s.cents > 0).map((s) => <div key={s.key} className={`${s.color} h-full`} style={{ width: `${(s.cents / barTotal) * 100}%` }} title={`${s.label}: ${money(s.cents)}`} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{money(summary.inflowCents, { compact: true })}</strong> {fr ? "entre" : "comes in"}</span>
                {segments.filter((s) => s.cents > 0).map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />{s.label} {money(s.cents, { compact: true })} <span className="opacity-70">({pctOf(s.cents)} %)</span></span>)}
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-muted/60 p-4 space-y-3">
            <div className="font-medium">{fr ? "Et si on dépensait moins ?" : "What if we spent a bit less?"} <How>{fr ? "Pourcentage appliqué à toutes les dépenses variables." : "Percentage applied to all flexible spending."}</How></div>
            <Slider value={[cutPct]} min={0} max={50} step={5} onValueChange={(v) => setCutPct(v[0])} aria-label="Cut percentage" />
            <p className="text-sm">{t("budget.cutSlider", { pct: cutPct, amount: money(Math.round((summary.flexibleCents * cutPct) / 100)) })}</p>
            <p className="text-sm text-muted-foreground">{fr ? "Flux libre après : " : "Free cash flow after: "}<Money cents={fcf + Math.round((summary.flexibleCents * cutPct) / 100)} sign colour className="font-semibold" /></p>
          </div>
        </CardContent>
      </Card>

      {/* Income */}
      <Section icon={<ArrowDownToLine />} title={t("budget.income")} hint={fr ? "Montants nets. Seules les lignes vers le compte courant comptent dans le budget." : "Net amounts. Only lines going to the spending account count toward the budget."}
        action={<Button size="sm" variant="soft" onClick={() => setDrawer({ kind: "income", row: null })}><Plus /> {t("common.add")}</Button>}>
        {inc.rows.length === 0 ? <EmptyState>{t("budget.emptyIncome")}</EmptyState> : inc.rows.map((r) => (
          <ListRow
            key={r.id}
            primary={<TextCell value={r.name} onCommit={(v) => inc.patch(r.id, { name: v }, updateIncome)} ariaLabel={t("common.name")} className="-ml-2 font-medium" />}
            mobilePrimary={r.name}
            mobileValue={money(r.amountCents)}
            secondary={<>{r.person ? personName(r.person) : fr ? "Ménage" : "Household"} · {destLabel[r.destination]}{r.investmentAccountId ? ` → ${accountName(r.investmentAccountId)}` : ""}</>}
            value={<MoneyCell cents={r.amountCents} onCommit={(v) => inc.patch(r.id, { amountCents: v }, updateIncome)} ariaLabel={t("common.amount")} className="w-28 font-semibold" />}
            valueSub={<>{freqLabel(r.frequency)}<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>{money(toMonthlyCents(r.amountCents, r.frequency), { compact: true })}{t("common.perMonth")}</>}
            muted={r.destination !== "SPENDING_ACCOUNT"}
            onClick={() => setDrawer({ kind: "income", row: r })}
          />
        ))}
        <TotalLine label={fr ? "Vers le compte courant" : "Into the spending account"} cents={summary.inflowCents} extra={summary.debtPaydownIncomeCents > 0 ? `${fr ? "directement vers la dette" : "straight to debt"}: ${money(summary.debtPaydownIncomeCents)}` : undefined} />
      </Section>

      {/* Debt payments */}
      <Section icon={<CreditCard />} title={t("budget.debtPayments")} hint={fr ? "Calculés à partir de vos dettes. Modifiez-les sur la page Plan de dettes." : "Computed from your debts. Edit them on the Debt plan page."}
        action={<Button size="sm" variant="ghost" asChild><Link href="/payoff">{t("nav.payoff")} →</Link></Button>}>
        {props.debts.map((d) => (
          <ListRow key={d.id} primary={d.name}
            secondary={d.type === "LEASE" ? (fr ? "location" : "lease") : <>{money(d.balanceCents, { compact: true })} · {pct(d.currentRateBps)} · {d.minimumType === "INTEREST_ONLY" ? (fr ? "intérêts seulement" : "interest-only") : d.minimumType === "PERCENT_OF_BALANCE" ? (fr ? "% du solde" : "% of balance") : (fr ? "paiement fixe" : "fixed payment")}</>}
            value={money(d.scheduledCents)} valueSub={fr ? "par mois" : "per month"} />
        ))}
        <TotalLine label={t("common.total")} cents={debtMin} />
      </Section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filtersActive ? "soft" : "outline"} size="sm" onClick={() => setFiltersOpen((v) => !v)}><Filter /> {fr ? "Filtrer" : "Filter"}{filtersActive ? " •" : ""}</Button>
        {filtersOpen && (
          <>
            <Select className="w-auto h-8 text-xs rounded-lg" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label={t("common.category")}>
              <option value="">{t("common.category")}: {t("common.all")}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select className="w-auto h-8 text-xs rounded-lg" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label={t("common.owner")}>
              <option value="">{t("common.owner")}: {t("common.all")}</option>
              <option value="SHARED">{t("common.shared")}</option>
              <option value="ALEX">{personName("ALEX")}</option>
              <option value="SELIA">{personName("SELIA")}</option>
            </Select>
            <label className="flex items-center gap-2 text-xs"><Switch checked={essentialOnly} onCheckedChange={setEssentialOnly} /> {t("budget.essentialOnly")}</label>
            {filtersActive && <button className="text-xs underline text-muted-foreground" onClick={() => { setCategoryFilter(""); setOwnerFilter(""); setEssentialOnly(false); }}>{fr ? "effacer" : "clear"}</button>}
          </>
        )}
      </div>

      {/* Fixed */}
      <Section icon={<Home />} title={t("budget.fixed")} hint={fr ? "Les factures annuelles sont converties en montant mensuel à mettre de côté." : "Annual bills are converted to a monthly amount to set aside."}
        action={<Button size="sm" variant="soft" onClick={() => setDrawer({ kind: "expense", row: null, type: "FIXED" })}><Plus /> {t("common.add")}</Button>}>
        {visibleExpenses.filter((e) => e.type === "FIXED").length === 0 ? <EmptyState>{t("budget.emptyExpense")}</EmptyState> : visibleExpenses.filter((e) => e.type === "FIXED").map(expenseRow)}
        <TotalLine label={t("common.total")} cents={summary.fixedCents} extra={`${pctOf(summary.fixedCents)} % ${t("budget.pctOfIncome")}`} />
      </Section>

      {/* Flexible */}
      <Section icon={<ShoppingBag />} title={t("budget.flexible")} hint={fr ? "Ce qu'on choisit de dépenser chaque mois." : "What we choose to spend each month."}
        action={<Button size="sm" variant="soft" onClick={() => setDrawer({ kind: "expense", row: null, type: "FLEXIBLE" })}><Plus /> {t("common.add")}</Button>}>
        {visibleExpenses.filter((e) => e.type === "FLEXIBLE").length === 0 ? <EmptyState>{t("budget.emptyExpense")}</EmptyState> : visibleExpenses.filter((e) => e.type === "FLEXIBLE").map(expenseRow)}
        <TotalLine label={t("common.total")} cents={summary.flexibleCents} extra={`${pctOf(summary.flexibleCents)} % ${t("budget.pctOfIncome")}`} />
      </Section>

      {/* Savings */}
      <Section icon={<PiggyBank />} title={t("budget.savings")} hint={fr ? "Cotisations aux placements. Une ligne ajoutée ici met à jour la projection et le flux libre." : "Contributions to your accounts. Adding a line here updates the projection and free cash flow."}
        action={<Button size="sm" variant="soft" disabled={leafAccounts.length === 0} onClick={() => setDrawer({ kind: "contribution", row: null })}><Plus /> {t("common.add")}</Button>}>
        {con.rows.length === 0 && visibleExpenses.filter((e) => e.type === "SAVINGS").length === 0 ? <EmptyState>{t("budget.emptySavings")}</EmptyState> : (
          <>
            {con.rows.map((r) => {
              const locked = !!r.incomeId;
              return (
                <ListRow key={r.id} primary={accountName(r.accountId)}
                  secondary={locked ? <Badge>{fr ? "retenue sur la paie" : "payroll deduction"}</Badge> : r.source === "SPENDING_ACCOUNT" ? (fr ? "depuis le compte courant" : "from the spending account") : (fr ? "montant unique" : "lump sum")}
                  value={locked ? money(r.amountCents) : <MoneyCell cents={r.amountCents} onCommit={(v) => con.patch(r.id, { amountCents: v }, updateContribution)} ariaLabel={t("common.amount")} className="w-28 font-semibold" />}
                  mobileValue={money(r.amountCents)}
                  valueSub={<>{freqLabel(r.frequency)} · {money(toMonthlyCents(r.amountCents, r.frequency), { compact: true })}{t("common.perMonth")}</>}
                  muted={locked}
                  onClick={locked ? undefined : () => setDrawer({ kind: "contribution", row: r })} />
              );
            })}
            {visibleExpenses.filter((e) => e.type === "SAVINGS").map(expenseRow)}
          </>
        )}
        <TotalLine label={fr ? "Depuis le compte courant" : "From the spending account"} cents={summary.savingsCents} extra={`${fr ? "retenues sur la paie (hors budget)" : "payroll (outside the budget)"}: ${money(summary.payrollContributionsCents)}`} />
      </Section>

      {/* Drawers */}
      <Dialog open={drawer !== null} onOpenChange={(o) => !o && setDrawer(null)}>
        {drawer?.kind === "expense" && (
          <ExpenseDrawer row={drawer.row} type={drawer.type} categories={categories} onClose={() => setDrawer(null)}
            onSave={async (data) => {
              if (drawer.row) await exp.patch(drawer.row.id, data, updateExpense);
              else await exp.add({ id: `tmp-${Date.now()}`, ...data, endDate: data.endDate ?? null, notes: data.notes ?? null } as ExpenseDTO, () => createExpense(data));
              setDrawer(null);
            }}
            onDelete={drawer.row ? async () => { await exp.remove(drawer.row!.id, deleteExpense, (row) => createExpense({ ...row })); setDrawer(null); } : undefined} />
        )}
        {drawer?.kind === "income" && (
          <IncomeDrawer row={drawer.row} accounts={leafAccounts} accountName={accountName} destLabel={destLabel} onClose={() => setDrawer(null)}
            onSave={async (data) => {
              if (drawer.row) await inc.patch(drawer.row.id, data, updateIncome);
              else await inc.add({ id: `tmp-${Date.now()}`, ...data, endDate: data.endDate ?? null, notes: data.notes ?? null, investmentAccountId: data.investmentAccountId ?? null } as IncomeDTO, () => createIncome(data));
              setDrawer(null);
            }}
            onDelete={drawer.row ? async () => { await inc.remove(drawer.row!.id, deleteIncome, (row) => createIncome({ ...row })); setDrawer(null); } : undefined} />
        )}
        {drawer?.kind === "contribution" && (
          <ContributionDrawer row={drawer.row} accounts={leafAccounts} accountName={accountName} onClose={() => setDrawer(null)}
            onSave={async (data) => {
              if (drawer.row) await con.patch(drawer.row.id, data, updateContribution);
              else await con.add({ id: `tmp-${Date.now()}`, ...data, endDate: data.endDate ?? null, notes: data.notes ?? null, incomeId: null } as ContributionDTO, () => createContribution(data));
              setDrawer(null);
            }}
            onDelete={drawer.row ? async () => { await con.remove(drawer.row!.id, deleteContribution, (row) => createContribution({ ...row })); setDrawer(null); } : undefined} />
        )}
      </Dialog>
    </div>
  );
}

function TotalLine({ label, cents, extra }: { label: string; cents: number; extra?: string }) {
  return (
    <div className="flex items-center justify-between pt-3 text-sm">
      <span className="text-muted-foreground">{label}{extra ? <span className="hidden sm:inline"> · {extra}</span> : null}</span>
      <Money cents={cents} className="font-semibold" />
    </div>
  );
}

/* ---------- Drawers ---------- */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function MoneyField({ cents, onChange, label }: { cents: number; onChange: (c: number) => void; label: string }) {
  const [v, setV] = React.useState((cents / 100).toFixed(2));
  return <Field label={label}><Input inputMode="decimal" className="text-right tabular text-base h-11" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const c = parseMoney(v); if (c !== null) onChange(c); }} /></Field>;
}

function FrequencyField({ value, onChange }: { value: Frequency; onChange: (f: Frequency) => void }) {
  const { t } = useApp();
  return <Field label={t("common.frequency")}><Select value={value} onChange={(e) => onChange(e.target.value as Frequency)}>{FREQUENCIES.map((f) => <option key={f} value={f}>{t(`freq.${f}` as const)}</option>)}</Select></Field>;
}

function DrawerFooter({ onSave, onDelete, saving }: { onSave: () => void; onDelete?: () => void; saving: boolean }) {
  const { t } = useApp();
  return (
    <div className="flex items-center justify-between pt-3 mt-auto">
      {onDelete ? <Button variant="ghost" className="text-act" onClick={onDelete} disabled={saving}><Trash2 /> {t("common.delete")}</Button> : <span />}
      <Button size="lg" onClick={onSave} disabled={saving}>{t("common.save")}</Button>
    </div>
  );
}

function ExpenseDrawer({ row, type, categories, onSave, onDelete }: { row: ExpenseDTO | null; type: "FIXED" | "FLEXIBLE" | "SAVINGS"; categories: string[]; onSave: (d: Omit<ExpenseDTO, "id">) => Promise<void>; onDelete?: () => Promise<void>; onClose: () => void }) {
  const { t, lang, personName } = useApp();
  const fr = lang === "fr";
  const [f, setF] = React.useState<Omit<ExpenseDTO, "id">>(row ? { ...row } : { name: "", category: categories[0] ?? (fr ? "Divers" : "Misc"), amountCents: 0, frequency: "MONTHLY", type, owner: "SHARED", essential: false, startDate: today(), endDate: null, notes: null });
  const [saving, setSaving] = React.useState(false);
  const [newCat, setNewCat] = React.useState(false);
  const title = row ? row.name : type === "FIXED" ? (fr ? "Nouvelle dépense fixe" : "New fixed expense") : type === "FLEXIBLE" ? (fr ? "Nouvelle dépense variable" : "New flexible expense") : (fr ? "Nouvelle épargne" : "New savings line");
  return (
    <DialogContent title={title} description={fr ? "Montant réel et fréquence ; le mensuel est calculé." : "Real amount and frequency; the monthly figure is computed."}>
      <div className="space-y-4 text-sm flex-1 flex flex-col">
        <Field label={t("common.name")}><Input autoFocus className="h-11 text-base" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField cents={f.amountCents} onChange={(c) => setF({ ...f, amountCents: c })} label={t("common.amount")} />
          <FrequencyField value={f.frequency} onChange={(fq) => setF({ ...f, frequency: fq })} />
        </div>
        <Field label={t("common.category")}>
          {newCat ? <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /> : (
            <Select value={categories.includes(f.category) ? f.category : "__new"} onChange={(e) => { if (e.target.value === "__new") { setNewCat(true); setF({ ...f, category: "" }); } else setF({ ...f, category: e.target.value }); }}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              {!categories.includes(f.category) && f.category && <option value={f.category}>{f.category}</option>}
              <option value="__new">+ {fr ? "Nouvelle catégorie…" : "New category…"}</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.owner")}><Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value as ExpenseDTO["owner"] })}><option value="SHARED">{t("common.shared")}</option><option value="ALEX">{personName("ALEX")}</option><option value="SELIA">{personName("SELIA")}</option></Select></Field>
          <Field label={t("common.type")}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ExpenseDTO["type"] })}><option value="FIXED">{t("budget.fixed")}</option><option value="FLEXIBLE">{t("budget.flexible")}</option><option value="SAVINGS">{fr ? "Épargne" : "Savings"}</option></Select></Field>
        </div>
        <label className="flex items-center justify-between rounded-xl border p-3"><span>{t("common.essential")}<span className="block text-xs text-muted-foreground">{fr ? "Indispensable, à garder même en coupant." : "Must keep, even when cutting."}</span></span><Switch checked={f.essential} onCheckedChange={(v) => setF({ ...f, essential: v })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={fr ? "Depuis" : "From"} hint={fr ? "Pour une facture annuelle : le mois où elle est due." : "For an annual bill: the month it is due."}><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label={fr ? "Jusqu'à (optionnel)" : "Until (optional)"}><Input type="date" value={f.endDate ?? ""} onChange={(e) => setF({ ...f, endDate: e.target.value || null })} /></Field>
        </div>
        <Field label={t("common.notes")}><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} placeholder={fr ? "ex. estimation — à remplacer par la vraie facture" : "e.g. estimate — replace with the real bill"} /></Field>
        <DrawerFooter saving={saving} onDelete={onDelete} onSave={async () => { if (!f.name.trim() || !f.category.trim()) return void toast.error(fr ? "Nom et catégorie requis" : "Name and category are required"); setSaving(true); await onSave(f); setSaving(false); }} />
      </div>
    </DialogContent>
  );
}

function IncomeDrawer({ row, accounts, accountName, destLabel, onSave, onDelete }: { row: IncomeDTO | null; accounts: AccountDTO[]; accountName: (id: string) => string; destLabel: Record<string, string>; onSave: (d: Omit<IncomeDTO, "id">) => Promise<void>; onDelete?: () => Promise<void>; onClose: () => void }) {
  const { t, lang, personName } = useApp();
  const fr = lang === "fr";
  const [f, setF] = React.useState<Omit<IncomeDTO, "id">>(row ? { ...row } : { person: "ALEX", name: "", amountCents: 0, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: today(), endDate: null, notes: null, investmentAccountId: null });
  const [saving, setSaving] = React.useState(false);
  const needsAccount = f.destination === "RRSP" || f.destination === "TFSA";
  return (
    <DialogContent title={row ? row.name : fr ? "Nouveau revenu" : "New income"} description={fr ? "Montant net, tel qu’il arrive." : "Net amount, as it lands."}>
      <div className="space-y-4 text-sm flex-1 flex flex-col">
        <Field label={t("common.name")}><Input autoFocus className="h-11 text-base" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField cents={f.amountCents} onChange={(c) => setF({ ...f, amountCents: c })} label={t("common.amount")} />
          <FrequencyField value={f.frequency} onChange={(fq) => setF({ ...f, frequency: fq })} />
        </div>
        <Field label={fr ? "De qui" : "Whose"}><Select value={f.person ?? "HOUSEHOLD"} onChange={(e) => setF({ ...f, person: e.target.value === "HOUSEHOLD" ? null : (e.target.value as "ALEX" | "SELIA") })}><option value="ALEX">{personName("ALEX")}</option><option value="SELIA">{personName("SELIA")}</option><option value="HOUSEHOLD">{fr ? "Ménage" : "Household"}</option></Select></Field>
        <Field label={t("budget.destination")} hint={fr ? "Compte courant = compte dans le budget. Remboursement de dette = va directement à la dette prioritaire." : "Spending account = counts in the budget. Debt paydown = goes straight to the top-priority debt."}>
          <Select value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value as IncomeDTO["destination"], investmentAccountId: null })}>{DESTINATIONS.map((d) => <option key={d} value={d}>{destLabel[d]}</option>)}</Select>
        </Field>
        {needsAccount && (
          <Field label={fr ? "Dans quel compte" : "Into which account"} hint={fr ? "Une ligne de cotisation est créée automatiquement." : "A contribution line is created automatically."}>
            <Select value={f.investmentAccountId ?? ""} onChange={(e) => setF({ ...f, investmentAccountId: e.target.value || null })}><option value="">—</option>{accounts.filter((a) => a.type === f.destination).map((a) => <option key={a.id} value={a.id}>{accountName(a.id)}</option>)}</Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={fr ? "Depuis" : "From"}><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label={fr ? "Jusqu'à (optionnel)" : "Until (optional)"}><Input type="date" value={f.endDate ?? ""} onChange={(e) => setF({ ...f, endDate: e.target.value || null })} /></Field>
        </div>
        <Field label={t("common.notes")}><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} /></Field>
        <DrawerFooter saving={saving} onDelete={onDelete} onSave={async () => { if (!f.name.trim()) return void toast.error(fr ? "Nom requis" : "Name is required"); setSaving(true); await onSave(f); setSaving(false); }} />
      </div>
    </DialogContent>
  );
}

function ContributionDrawer({ row, accounts, accountName, onSave, onDelete }: { row: ContributionDTO | null; accounts: AccountDTO[]; accountName: (id: string) => string; onSave: (d: Omit<ContributionDTO, "id" | "incomeId">) => Promise<void>; onDelete?: () => Promise<void>; onClose: () => void }) {
  const { t, lang } = useApp();
  const fr = lang === "fr";
  const first = accounts.find((a) => a.type !== "CASH") ?? accounts[0];
  const [f, setF] = React.useState<Omit<ContributionDTO, "id" | "incomeId">>(row ? { ...row } : { accountId: first?.id ?? "", amountCents: 0, frequency: "MONTHLY", source: "SPENDING_ACCOUNT", startDate: today(), endDate: null, notes: null });
  const [saving, setSaving] = React.useState(false);
  return (
    <DialogContent title={row ? accountName(row.accountId) : fr ? "Nouvelle cotisation" : "New contribution"} description={fr ? "Le flux libre, le plan de dettes et la projection sont mis à jour." : "Free cash flow, the debt plan and the projection all update."}>
      <div className="space-y-4 text-sm flex-1 flex flex-col">
        <Field label={fr ? "Compte" : "Account"}><Select autoFocus value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a.id)}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField cents={f.amountCents} onChange={(c) => setF({ ...f, amountCents: c })} label={t("common.amount")} />
          <FrequencyField value={f.frequency} onChange={(fq) => setF({ ...f, frequency: fq })} />
        </div>
        <Field label="Source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as ContributionDTO["source"] })}><option value="SPENDING_ACCOUNT">{fr ? "Depuis le compte courant" : "From the spending account"}</option><option value="LUMP_SUM">{fr ? "Montant unique" : "Lump sum"}</option></Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={fr ? "Depuis" : "From"}><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label={fr ? "Jusqu'à (optionnel)" : "Until (optional)"}><Input type="date" value={f.endDate ?? ""} onChange={(e) => setF({ ...f, endDate: e.target.value || null })} /></Field>
        </div>
        <DrawerFooter saving={saving} onDelete={onDelete} onSave={async () => { if (!f.accountId) return; setSaving(true); await onSave(f); setSaving(false); }} />
      </div>
    </DialogContent>
  );
}
