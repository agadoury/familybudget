"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { CheckCell, MoneyCell, SelectCell, TextCell } from "@/components/app/inline";
import { useOptimisticRows } from "@/components/app/use-optimistic-rows";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FREQUENCIES, monthKey, toMonthlyCents, type Frequency } from "@/lib/frequency";
import { computeBudget } from "@/lib/budget/compute";
import type { AccountDTO, ContributionDTO, ExpenseDTO, IncomeDTO } from "@/lib/dto";
import {
  createContribution, createExpense, createIncome, deleteContribution, deleteExpense, deleteIncome,
  updateContribution, updateExpense, updateIncome,
} from "@/lib/actions/budget";
import { importBudgetCsv } from "@/lib/actions/csv";

type DebtLite = { id: string; name: string; type: string; balanceCents: number; scheduledCents: number; currentRateBps: number; minimumType: string };

const DESTINATIONS = ["SPENDING_ACCOUNT", "RRSP", "STOCK_PLAN", "TFSA", "DEBT_PAYDOWN", "OTHER"] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function BudgetTable(props: {
  incomes: IncomeDTO[];
  expenses: ExpenseDTO[];
  contributions: ContributionDTO[];
  accounts: AccountDTO[];
  debts: DebtLite[];
}) {
  const { t, money, pct, personName, lang } = useApp();
  const router = useRouter();
  const labels = React.useMemo(() => ({ saved: t("common.saved"), deleted: t("common.deleted"), undo: t("common.undo") }), [t]);
  const inc = useOptimisticRows(props.incomes, labels);
  const exp = useOptimisticRows(props.expenses, labels);
  const con = useOptimisticRows(props.contributions, labels);

  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("");
  const [essentialOnly, setEssentialOnly] = React.useState(false);
  const [cutPct, setCutPct] = React.useState(10);

  const freqLabel = (f: Frequency) => t(`freq.${f}` as const);
  const freqOptions = FREQUENCIES.map((f) => ({ value: f, label: freqLabel(f) }));
  const destLabel: Record<(typeof DESTINATIONS)[number], string> = lang === "fr"
    ? { SPENDING_ACCOUNT: "Compte courant", RRSP: "REER", STOCK_PLAN: "Régime d'actions", TFSA: "CELI", DEBT_PAYDOWN: "Remboursement de dette", OTHER: "Autre" }
    : { SPENDING_ACCOUNT: "Spending account", RRSP: "RRSP", STOCK_PLAN: "Stock plan", TFSA: "TFSA", DEBT_PAYDOWN: "Debt paydown", OTHER: "Other" };

  const m = monthKey(new Date());
  const summary = computeBudget(m, inc.rows, exp.rows, con.rows);
  const debtMin = props.debts.reduce((s, d) => s + d.scheduledCents, 0);
  const committed = summary.fixedCents + summary.savingsCents + debtMin;
  const fcf = summary.inflowCents - committed - summary.flexibleCents;
  const categories = [...new Set(exp.rows.map((e) => e.category))].sort();

  const visibleExpenses = exp.rows.filter(
    (e) => (!categoryFilter || e.category === categoryFilter) && (!ownerFilter || e.owner === ownerFilter) && (!essentialOnly || e.essential),
  );
  const accountName = (id: string) => {
    const a = props.accounts.find((x) => x.id === id);
    if (!a) return "?";
    const parent = a.parentId ? props.accounts.find((x) => x.id === a.parentId) : null;
    return `${personName(a.owner)} · ${parent ? `${parent.name} › ` : ""}${a.name}`;
  };
  const pctOf = (cents: number) => (summary.inflowCents > 0 ? `${((cents / summary.inflowCents) * 100).toFixed(0)} %` : "—");

  async function onImport(file: File) {
    const text = await file.text();
    const res = await importBudgetCsv(text);
    if (res.ok) {
      toast.success(`${res.data.created} created, ${res.data.updated} updated`);
      router.refresh();
    } else toast.error(res.error);
  }

  const Section = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-xl font-semibold">{t("budget.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-auto h-8 text-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label={t("common.category")}>
            <option value="">{t("common.category")}: {t("common.all")}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select className="w-auto h-8 text-xs" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label={t("common.owner")}>
            <option value="">{t("common.owner")}: {t("common.all")}</option>
            <option value="SHARED">{t("common.shared")}</option>
            <option value="ALEX">{personName("ALEX")}</option>
            <option value="SELIA">{personName("SELIA")}</option>
          </Select>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={essentialOnly} onCheckedChange={setEssentialOnly} /> {t("budget.essentialOnly")}
          </label>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/budget/csv" download><Download /> {t("budget.exportCsv")}</a>
          </Button>
          <label className="inline-flex">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <span className="inline-flex items-center gap-2 h-8 px-3 rounded-md border text-xs font-medium cursor-pointer hover:bg-accent"><Upload className="h-4 w-4" /> {t("budget.importCsv")}</span>
          </label>
        </div>
      </div>

      {/* Income */}
      <Section
        title={t("budget.income")}
        right={<Button size="sm" variant="ghost" onClick={() => inc.add(
          { id: `tmp-${Date.now()}`, person: "ALEX", name: lang === "fr" ? "Nouveau revenu" : "New income", amountCents: 0, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: today(), endDate: null, notes: null, investmentAccountId: null },
          () => createIncome({ person: "ALEX", name: lang === "fr" ? "Nouveau revenu" : "New income", amountCents: 0, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: today() }),
        )}><Plus /> {t("budget.addRow")}</Button>}
      >
        {inc.rows.length === 0 ? <Empty>{t("budget.emptyIncome")}</Empty> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("common.owner")}</TableHead><TableHead>{t("common.name")}</TableHead><TableHead className="text-right">{t("budget.native")}</TableHead>
              <TableHead>{t("common.frequency")}</TableHead><TableHead>{t("budget.destination")}</TableHead><TableHead className="text-right">{t("budget.monthly")}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {inc.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="w-28"><SelectCell value={r.person ?? "HOUSEHOLD"} options={[{ value: "ALEX", label: personName("ALEX") }, { value: "SELIA", label: personName("SELIA") }, { value: "HOUSEHOLD", label: lang === "fr" ? "Ménage" : "Household" }]} onCommit={(v) => inc.patch(r.id, { person: v === "HOUSEHOLD" ? null : (v as "ALEX" | "SELIA") }, updateIncome)} ariaLabel={t("common.owner")} /></TableCell>
                  <TableCell><TextCell value={r.name} onCommit={(v) => inc.patch(r.id, { name: v }, updateIncome)} ariaLabel={t("common.name")} /></TableCell>
                  <TableCell className="w-32"><MoneyCell cents={r.amountCents} onCommit={(v) => inc.patch(r.id, { amountCents: v }, updateIncome)} ariaLabel={t("common.amount")} /></TableCell>
                  <TableCell className="w-36"><SelectCell value={r.frequency} options={freqOptions} onCommit={(v) => inc.patch(r.id, { frequency: v }, updateIncome)} ariaLabel={t("common.frequency")} /></TableCell>
                  <TableCell className="w-44">
                    <SelectCell value={r.destination} options={DESTINATIONS.map((d) => ({ value: d, label: destLabel[d] }))} onCommit={(v) => inc.patch(r.id, { destination: v }, updateIncome)} ariaLabel={t("budget.destination")} />
                    {(r.destination === "RRSP" || r.destination === "TFSA") && (
                      <select className="cell-input text-xs mt-0.5" value={r.investmentAccountId ?? ""} aria-label="Account" onChange={(e) => inc.patch(r.id, { investmentAccountId: e.target.value || null }, updateIncome)}>
                        <option value="">— {lang === "fr" ? "compte" : "account"} —</option>
                        {props.accounts.filter((a) => a.type === r.destination && !props.accounts.some((c) => c.parentId === a.id)).map((a) => <option key={a.id} value={a.id}>{accountName(a.id)}</option>)}
                      </select>
                    )}
                  </TableCell>
                  <TableCell className="text-right w-32"><Money cents={toMonthlyCents(r.amountCents, r.frequency)} className={r.destination !== "SPENDING_ACCOUNT" ? "text-muted-foreground" : ""} /></TableCell>
                  <TableCell className="w-10"><DeleteBtn onClick={() => inc.remove(r.id, deleteIncome, (row) => createIncome({ ...row }))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">
          {lang === "fr" ? "Seules les lignes vers le compte courant comptent dans le budget. " : "Only lines to the spending account count toward the budget. "}
          <Money cents={summary.inflowCents} /> {t("common.perMonth")}
          {summary.debtPaydownIncomeCents > 0 && <> · {lang === "fr" ? "vers la dette" : "to debt"}: <Money cents={summary.debtPaydownIncomeCents} /></>}
        </p>
      </Section>

      {/* Debt payments (derived) */}
      <Section title={t("budget.debtPayments")} right={<Button size="sm" variant="ghost" asChild><Link href="/payoff">{t("budget.debtLink")} →</Link></Button>}>
        <Table>
          <TableHeader><TableRow><TableHead>{t("common.name")}</TableHead><TableHead className="text-right">{t("common.balance")}</TableHead><TableHead className="text-right">{t("common.rate")}</TableHead><TableHead className="text-right">{t("budget.monthly")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {props.debts.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.name} <span className="text-xs text-muted-foreground">({d.minimumType === "INTEREST_ONLY" ? (lang === "fr" ? "intérêts seulement" : "interest-only") : d.minimumType === "PERCENT_OF_BALANCE" ? (lang === "fr" ? "% du solde" : "% of balance") : (lang === "fr" ? "fixe" : "fixed")})</span></TableCell>
                <TableCell className="text-right">{d.type === "LEASE" ? "—" : <Money cents={d.balanceCents} />}</TableCell>
                <TableCell className="text-right">{d.type === "LEASE" ? "—" : pct(d.currentRateBps)}</TableCell>
                <TableCell className="text-right"><Money cents={d.scheduledCents} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* Fixed / Flexible */}
      {(["FIXED", "FLEXIBLE"] as const).map((type) => (
        <Section
          key={type}
          title={type === "FIXED" ? t("budget.fixed") : t("budget.flexible")}
          right={<Button size="sm" variant="ghost" onClick={() => exp.add(
            { id: `tmp-${Date.now()}`, name: lang === "fr" ? "Nouvelle dépense" : "New expense", category: categoryFilter || (lang === "fr" ? "Divers" : "Misc"), amountCents: 0, frequency: "MONTHLY", type, owner: "SHARED", essential: false, startDate: today(), endDate: null, notes: null },
            () => createExpense({ name: lang === "fr" ? "Nouvelle dépense" : "New expense", category: categoryFilter || (lang === "fr" ? "Divers" : "Misc"), amountCents: 0, frequency: "MONTHLY", type, owner: "SHARED", essential: false, startDate: today() }),
          )}><Plus /> {t("budget.addRow")}</Button>}
        >
          {visibleExpenses.filter((e) => e.type === type).length === 0 ? <Empty>{t("budget.emptyExpense")}</Empty> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("common.name")}</TableHead><TableHead>{t("common.category")}</TableHead><TableHead className="text-right">{t("budget.native")}</TableHead>
                <TableHead>{t("common.frequency")}</TableHead><TableHead>{t("common.owner")}</TableHead><TableHead className="text-center">{t("common.essential")}</TableHead><TableHead className="text-right">{t("budget.monthly")}</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {visibleExpenses.filter((e) => e.type === type).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <TextCell value={r.name} onCommit={(v) => exp.patch(r.id, { name: v }, updateExpense)} ariaLabel={t("common.name")} />
                      {r.notes?.toLowerCase().startsWith("estimate") && <Badge variant="watch" className="ml-2">{t("common.estimate")}</Badge>}
                    </TableCell>
                    <TableCell className="w-44"><TextCell value={r.category} onCommit={(v) => exp.patch(r.id, { category: v }, updateExpense)} ariaLabel={t("common.category")} /></TableCell>
                    <TableCell className="w-32"><MoneyCell cents={r.amountCents} onCommit={(v) => exp.patch(r.id, { amountCents: v }, updateExpense)} ariaLabel={t("common.amount")} /></TableCell>
                    <TableCell className="w-36"><SelectCell value={r.frequency} options={freqOptions} onCommit={(v) => exp.patch(r.id, { frequency: v }, updateExpense)} ariaLabel={t("common.frequency")} /></TableCell>
                    <TableCell className="w-28"><SelectCell value={r.owner} options={[{ value: "SHARED", label: t("common.shared") }, { value: "ALEX", label: personName("ALEX") }, { value: "SELIA", label: personName("SELIA") }]} onCommit={(v) => exp.patch(r.id, { owner: v }, updateExpense)} ariaLabel={t("common.owner")} /></TableCell>
                    <TableCell className="text-center w-16"><CheckCell checked={r.essential} onCommit={(v) => exp.patch(r.id, { essential: v }, updateExpense)} ariaLabel={t("common.essential")} /></TableCell>
                    <TableCell className="text-right w-32">
                      <Money cents={toMonthlyCents(r.amountCents, r.frequency)} />
                      {(r.frequency === "ANNUAL" || r.frequency === "QUARTERLY") && (
                        <How>{lang === "fr" ? `Fonds de réserve : ${money(r.amountCents)} ${freqLabel(r.frequency)} ÷ ${r.frequency === "ANNUAL" ? 12 : 3}` : `Sinking fund: ${money(r.amountCents)} ${freqLabel(r.frequency)} ÷ ${r.frequency === "ANNUAL" ? 12 : 3}`}</How>
                      )}
                    </TableCell>
                    <TableCell className="w-10"><DeleteBtn onClick={() => exp.remove(r.id, deleteExpense, (row) => createExpense({ ...row }))} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground text-right">
            {t("common.total")}: <Money cents={type === "FIXED" ? summary.fixedCents : summary.flexibleCents} /> · {pctOf(type === "FIXED" ? summary.fixedCents : summary.flexibleCents)} {t("budget.pctOfIncome")}
          </p>
        </Section>
      ))}

      {/* Savings & investments */}
      <Section
        title={t("budget.savings")}
        right={<Button size="sm" variant="ghost" disabled={props.accounts.length === 0} onClick={() => {
          const leaf = props.accounts.find((a) => !props.accounts.some((c) => c.parentId === a.id) && a.type !== "CASH") ?? props.accounts[0];
          return con.add(
            { id: `tmp-${Date.now()}`, accountId: leaf.id, amountCents: 0, frequency: "MONTHLY", source: "SPENDING_ACCOUNT", startDate: today(), endDate: null, incomeId: null, notes: null },
            () => createContribution({ accountId: leaf.id, amountCents: 0, frequency: "MONTHLY", source: "SPENDING_ACCOUNT", startDate: today() }),
          );
        }}><Plus /> {t("budget.addRow")}</Button>}
      >
        {con.rows.length === 0 ? <Empty>{t("budget.emptySavings")}</Empty> : (
          <Table>
            <TableHeader><TableRow><TableHead>{lang === "fr" ? "Compte" : "Account"}</TableHead><TableHead>Source</TableHead><TableHead className="text-right">{t("budget.native")}</TableHead><TableHead>{t("common.frequency")}</TableHead><TableHead className="text-right">{t("budget.monthly")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {con.rows.map((r) => {
                const locked = !!r.incomeId;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {locked ? accountName(r.accountId) : (
                        <select className="cell-input" value={r.accountId} aria-label="Account" onChange={(e) => con.patch(r.id, { accountId: e.target.value }, updateContribution)}>
                          {props.accounts.filter((a) => !props.accounts.some((c) => c.parentId === a.id)).map((a) => <option key={a.id} value={a.id}>{accountName(a.id)}</option>)}
                        </select>
                      )}
                    </TableCell>
                    <TableCell className="w-40">{locked ? <Badge>{lang === "fr" ? "retenue à la source" : "payroll"}</Badge> : <SelectCell value={r.source} options={[{ value: "SPENDING_ACCOUNT", label: lang === "fr" ? "Compte courant" : "From spending account" }, { value: "LUMP_SUM", label: lang === "fr" ? "Montant unique" : "Lump sum" }]} onCommit={(v) => con.patch(r.id, { source: v }, updateContribution)} />}</TableCell>
                    <TableCell className="w-32">{locked ? <span className="tabular block text-right px-2"><Money cents={r.amountCents} /></span> : <MoneyCell cents={r.amountCents} onCommit={(v) => con.patch(r.id, { amountCents: v }, updateContribution)} ariaLabel={t("common.amount")} />}</TableCell>
                    <TableCell className="w-36">{locked ? <span className="px-2">{freqLabel(r.frequency)}</span> : <SelectCell value={r.frequency} options={freqOptions} onCommit={(v) => con.patch(r.id, { frequency: v }, updateContribution)} />}</TableCell>
                    <TableCell className="text-right w-32"><Money cents={toMonthlyCents(r.amountCents, r.frequency)} className={r.source !== "SPENDING_ACCOUNT" ? "text-muted-foreground" : ""} /></TableCell>
                    <TableCell className="w-10">{!locked && <DeleteBtn onClick={() => con.remove(r.id, deleteContribution, (row) => createContribution({ ...row }))} />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">
          {lang === "fr" ? "Retenues à la source (hors budget) : " : "Payroll (outside the budget): "}<Money cents={summary.payrollContributionsCents} /> · {lang === "fr" ? "depuis le compte courant : " : "from the spending account: "}<Money cents={summary.savingsCents} />
        </p>
      </Section>

      {/* Bottom summary */}
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] pt-4">
          <div className="space-y-1 text-sm">
            <Row label={t("dash.inflow")} cents={summary.inflowCents} pct="100 %" />
            <Row label={t("budget.fixed")} cents={-summary.fixedCents} pct={pctOf(summary.fixedCents)} />
            <Row label={t("budget.debtPayments")} cents={-debtMin} pct={pctOf(debtMin)} />
            <Row label={t("budget.savings")} cents={-summary.savingsCents} pct={pctOf(summary.savingsCents)} />
            <Row label={t("budget.flexible")} cents={-summary.flexibleCents} pct={pctOf(summary.flexibleCents)} />
            <div className="flex items-center justify-between border-t pt-1 font-semibold">
              <span>{t("dash.freeCashFlow")} <How>{lang === "fr" ? "Entrées − fixes − paiements de dettes − épargne − variables" : "Inflow − fixed − debt payments − savings − flexible"}</How></span>
              <span className={fcf < 0 ? "text-act" : "text-good"}><Money cents={fcf} sign /> {fcf < 0 ? (lang === "fr" ? "(déficit)" : "(deficit)") : ""}</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm">
              {t("budget.cutSlider", { pct: cutPct, amount: money(Math.round((summary.flexibleCents * cutPct) / 100)) })}
            </p>
            <Slider value={[cutPct]} min={0} max={50} step={5} onValueChange={(v) => setCutPct(v[0])} aria-label="Cut percentage" />
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? "Flux libre après coupe : " : "Free cash flow after the cut: "}
              <Money cents={fcf + Math.round((summary.flexibleCents * cutPct) / 100)} sign colour />
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, cents, pct }: { label: string; cents: number; pct: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex gap-3"><span className="text-xs text-muted-foreground w-12 text-right">{pct}</span><Money cents={cents} className="w-28 inline-block text-right" /></span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-act" aria-label="Delete" onClick={onClick}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
