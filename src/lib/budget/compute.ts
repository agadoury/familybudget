import { activeInMonth, toMonthlyCents, type Frequency, type MonthKey } from "@/lib/frequency";

/** Plain-data shapes (subset of the Prisma rows) so this module stays testable without a DB. */
export interface IncomeRow {
  id: string;
  person: "ALEX" | "SELIA";
  name: string;
  amountCents: number;
  frequency: Frequency;
  destination: "SPENDING_ACCOUNT" | "RRSP" | "STOCK_PLAN" | "TFSA" | "DEBT_PAYDOWN" | "OTHER";
  startDate: Date | string;
  endDate?: Date | string | null;
}

export interface ExpenseRow {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  frequency: Frequency;
  type: "FIXED" | "FLEXIBLE" | "SAVINGS";
  owner: "SHARED" | "ALEX" | "SELIA";
  essential: boolean;
  startDate: Date | string;
  endDate?: Date | string | null;
}

export interface ContributionRow {
  id: string;
  accountId: string;
  amountCents: number;
  frequency: Frequency;
  source: "PAYROLL" | "SPENDING_ACCOUNT" | "LUMP_SUM";
  startDate: Date | string;
  endDate?: Date | string | null;
}

export interface ExpenseCut {
  expenseId?: string;
  category?: string;
  cents?: number;
  pct?: number;
}

export interface BudgetSummary {
  month: MonthKey;
  inflowCents: number;
  fixedCents: number;
  flexibleCents: number;
  /** SAVINGS-type expenses + contributions paid from the spending account. */
  savingsCents: number;
  /** Payroll contributions (informational; never in the spending account). */
  payrollContributionsCents: number;
  debtPaydownIncomeCents: number;
  /** inflow − fixed − flexible − savings (before any debt payment). */
  surplusExDebtCents: number;
  byCategory: { category: string; cents: number; type: ExpenseRow["type"] }[];
  expenseMonthly: Record<string, number>;
}

/** Apply scenario expense cuts to an expense's monthly amount. */
export function cutMonthly(e: ExpenseRow, monthly: number, cuts: ExpenseCut[]): number {
  let out = monthly;
  for (const c of cuts) {
    const match = (c.expenseId && c.expenseId === e.id) || (c.category && c.category === e.category);
    if (!match) continue;
    if (c.cents !== undefined) out -= c.cents;
    if (c.pct !== undefined) out -= Math.round((out * c.pct) / 100);
  }
  return Math.max(0, out);
}

export function computeBudget(
  month: MonthKey,
  incomes: IncomeRow[],
  expenses: ExpenseRow[],
  contributions: ContributionRow[],
  cuts: ExpenseCut[] = [],
): BudgetSummary {
  let inflow = 0;
  let debtPaydown = 0;
  for (const i of incomes) {
    if (!activeInMonth(month, i.startDate, i.endDate)) continue;
    const m = toMonthlyCents(i.amountCents, i.frequency);
    if (i.destination === "SPENDING_ACCOUNT") inflow += m;
    else if (i.destination === "DEBT_PAYDOWN") debtPaydown += m;
  }

  let fixed = 0;
  let flexible = 0;
  let savings = 0;
  const cat = new Map<string, { cents: number; type: ExpenseRow["type"] }>();
  const expenseMonthly: Record<string, number> = {};
  for (const e of expenses) {
    if (!activeInMonth(month, e.startDate, e.endDate)) continue;
    const m = cutMonthly(e, toMonthlyCents(e.amountCents, e.frequency), cuts);
    expenseMonthly[e.id] = m;
    if (e.type === "FIXED") fixed += m;
    else if (e.type === "FLEXIBLE") flexible += m;
    else savings += m;
    const c = cat.get(e.category) ?? { cents: 0, type: e.type };
    c.cents += m;
    cat.set(e.category, c);
  }

  let payroll = 0;
  for (const c of contributions) {
    if (!activeInMonth(month, c.startDate, c.endDate)) continue;
    const m = toMonthlyCents(c.amountCents, c.frequency);
    if (c.source === "SPENDING_ACCOUNT") savings += m;
    else if (c.source === "PAYROLL") payroll += m;
  }

  return {
    month,
    inflowCents: inflow,
    fixedCents: fixed,
    flexibleCents: flexible,
    savingsCents: savings,
    payrollContributionsCents: payroll,
    debtPaydownIncomeCents: debtPaydown,
    surplusExDebtCents: inflow - fixed - flexible - savings,
    byCategory: [...cat.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.cents - a.cents),
    expenseMonthly,
  };
}
