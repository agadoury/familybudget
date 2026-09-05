/**
 * Assembles engine inputs from database-shaped rows plus scenario overrides.
 * Pure: no Prisma import, so it is unit-testable and runs on the client if needed.
 */
import { addMonths, monthKey, monthKeyFromParts, parseMonthKey, toMonthlyCents, type Frequency, type MonthKey } from "@/lib/frequency";
import { computeBudget, type BudgetSummary, type ContributionRow, type ExpenseRow, type IncomeRow } from "@/lib/budget/compute";
import {
  runPayoff,
  type DebtInput,
  type LumpSum,
  type PayoffInput,
  type PayoffResult,
  type ScenarioOverrides,
} from "@/lib/payoff";
import { runInvest, type InvestAccountInput, type InvestInput, type InvestResult } from "@/lib/invest";

export interface DebtRow {
  id: string;
  name: string;
  type: "LOC" | "CREDIT_CARD" | "CAR_LOAN" | "LEASE" | "MORTGAGE" | "OTHER";
  balanceCents: number;
  balanceAsOf: Date | string;
  priority: number;
  minimumType: "FIXED" | "PERCENT_OF_BALANCE" | "INTEREST_ONLY";
  minimumCents: number;
  minimumBps: number;
  minimumFloorCents: number;
  endDate?: Date | string | null;
  includeInPayoff: boolean;
  includeInNetWorth: boolean;
  rates: { effectiveDate: Date | string; annualRateBps: number }[];
}

export interface LumpSumScheduleRow {
  id: string;
  name: string;
  amountCents: number;
  months: number[];
  startDate: Date | string;
  endDate?: Date | string | null;
  active: boolean;
}

export interface AccountRow {
  id: string;
  name: string;
  owner: "ALEX" | "SELIA" | "JOINT";
  type: InvestAccountInput["kind"];
  parentId?: string | null;
  balanceCents: number;
  balanceAsOf: Date | string;
  returnBps: number;
  includeInNetWorth: boolean;
}

export interface BonusRow {
  id: string;
  person: "ALEX" | "SELIA";
  amountCents: number;
  expectedYear: number;
  expectedMonth: number;
  confidence: "UNCONFIRMED" | "CONFIRMED";
  pctAppliedBps: number;
}

export interface HouseholdData {
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  contributions: ContributionRow[];
  debts: DebtRow[];
  lumpSumSchedules: LumpSumScheduleRow[];
  accounts: AccountRow[];
  bonuses: BonusRow[];
  settings: {
    defaultReturnBps: number;
    homeValueCents: number;
    cashBufferCents: number;
    /** Marginal tax rate per person (bps); payroll RRSP redirects reach debt net of this. */
    marginalRateBps?: { ALEX: number; SELIA: number };
  };
}

export interface ProjectionOptions {
  startMonth: MonthKey;
  overrides: ScenarioOverrides;
  /** Include unconfirmed bonuses as lump sums (what-if overlay only). */
  withBonuses?: boolean;
  horizonMonths?: number;
  investMonths?: number;
  respGrants?: boolean;
}

export interface Projection {
  budget: BudgetSummary;
  payoff: PayoffResult;
  invest: InvestResult;
  payoffInput: PayoffInput;
  investInput: InvestInput;
  /** Net worth per month (investments included − consumer/other debts), mortgage excluded. */
  netWorth: { month: MonthKey; cents: number; withHomeCents: number }[];
  currentNetWorthCents: number;
  currentNetWorthWithHomeCents: number;
  consumerDebtCents: number;
}

/** After-tax cash from stopping a payroll deduction: RRSP deductions are pre-tax, TFSA ones are not. */
export function netOfTax(
  grossCents: number,
  owner: "ALEX" | "SELIA" | "JOINT" | undefined,
  accountType: string | undefined,
  rates?: { ALEX: number; SELIA: number },
): number {
  if (accountType !== "RRSP" || !rates) return grossCents;
  const bps = owner === "ALEX" ? rates.ALEX : owner === "SELIA" ? rates.SELIA : Math.round((rates.ALEX + rates.SELIA) / 2);
  return Math.round((grossCents * (10_000 - bps)) / 10_000);
}

export function currentRateBps(d: DebtRow, asOf: Date = new Date()): number {
  const k = monthKey(asOf);
  return rateHistory(d).reduce((cur, p) => (p.month <= k ? p.annualRateBps : cur), rateHistory(d)[0]?.annualRateBps ?? 0);
}

function rateHistory(d: DebtRow) {
  return [...d.rates]
    .map((r) => ({ month: monthKey(new Date(r.effectiveDate)), annualRateBps: r.annualRateBps }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function toDebtInput(d: DebtRow, overrides: ScenarioOverrides): DebtInput {
  const rates = rateHistory(d);
  for (const rc of overrides.rateChanges) {
    if (rc.debtId === d.id) rates.push({ month: rc.month, annualRateBps: rc.annualRateBps });
  }
  rates.sort((a, b) => a.month.localeCompare(b.month));
  return {
    id: d.id,
    name: d.name,
    kind: d.type,
    balanceCents: d.balanceCents,
    rates,
    minimum:
      d.minimumType === "FIXED"
        ? { type: "FIXED", cents: d.minimumCents }
        : d.minimumType === "PERCENT_OF_BALANCE"
          ? { type: "PERCENT_OF_BALANCE", bps: d.minimumBps, floorCents: d.minimumFloorCents }
          : { type: "INTEREST_ONLY" },
    priority: d.priority,
    endMonth: d.endDate ? monthKey(new Date(d.endDate)) : null,
    includeInPayoff: d.includeInPayoff,
    absorbsDeficit: d.type === "LOC",
  };
}

/** This month's scheduled payment for a debt, for the Budget page (same rule as the engine's month 0). */
export function scheduledNow(d: DebtRow): number {
  const rate = currentRateBps(d);
  const interest = Math.round((d.balanceCents * rate) / 10_000 / 12);
  let p: number;
  switch (d.minimumType) {
    case "FIXED":
      p = d.minimumCents;
      break;
    case "PERCENT_OF_BALANCE":
      p = Math.max(d.minimumFloorCents, Math.round(((d.balanceCents + interest) * d.minimumBps) / 10_000));
      break;
    case "INTEREST_ONLY":
      p = interest;
      break;
  }
  if (d.type === "LEASE") return p;
  if (d.endDate && monthKey(new Date(d.endDate)) < monthKey(new Date())) return 0;
  return Math.min(p, d.balanceCents + interest);
}

export function scheduleLumpSums(
  schedules: LumpSumScheduleRow[],
  startMonth: MonthKey,
  horizonMonths: number,
  overrides: ScenarioOverrides,
): LumpSum[] {
  const out: LumpSum[] = [];
  for (const s of schedules) {
    if (!s.active) continue;
    const cents = overrides.lumpSumScheduleCents[s.id] ?? s.amountCents;
    const sStart = monthKey(new Date(s.startDate));
    const sEnd = s.endDate ? monthKey(new Date(s.endDate)) : null;
    for (let i = 0; i < horizonMonths; i++) {
      const m = addMonths(startMonth, i);
      if (m < sStart || (sEnd && m > sEnd)) continue;
      const { month } = parseMonthKey(m);
      if (s.months.includes(month)) out.push({ month: m, cents, label: s.name, kind: "scheduled" });
    }
  }
  return out;
}

export function bonusLumpSums(bonuses: BonusRow[], startMonth: MonthKey): LumpSum[] {
  return bonuses
    .filter((b) => b.confidence === "UNCONFIRMED")
    .map((b) => ({
      month: monthKeyFromParts(b.expectedYear, b.expectedMonth),
      cents: Math.round((b.amountCents * b.pctAppliedBps) / 10_000),
      label: `${b.person === "ALEX" ? "Alex" : "Sélia"} bonus (unconfirmed)`,
      kind: "bonus" as const,
    }))
    .filter((l) => l.month >= startMonth && l.cents > 0);
}

function contributionsForAccount(
  accountId: string,
  contributions: ContributionRow[],
  overrides: ScenarioOverrides,
): InvestAccountInput["contributions"] {
  const out: InvestAccountInput["contributions"] = contributions
    .filter((c) => c.accountId === accountId && c.source !== "LUMP_SUM")
    .map((c) => ({
      id: c.id,
      monthlyCents: toMonthlyCents(c.amountCents, c.frequency as Frequency),
      startMonth: monthKey(new Date(c.startDate)),
      endMonth: c.endDate ? monthKey(new Date(c.endDate)) : null,
    }));
  for (const x of overrides.extraContributions) {
    if (x.accountId === accountId && x.cents > 0) out.push({ id: `extra:${accountId}`, monthlyCents: x.cents });
  }
  return out;
}

export function buildProjection(data: HouseholdData, opts: ProjectionOptions): Projection {
  const { startMonth, overrides } = opts;
  const horizon = opts.horizonMonths ?? 480;
  const investMonths = opts.investMonths ?? 360;

  // Redirected contributions add to the debt extra pool and are removed from the investment inputs.
  const redirectExtras = overrides.redirects.map((r) => {
    const c = data.contributions.find((x) => x.id === r.contributionId);
    const monthly = c ? toMonthlyCents(c.amountCents, c.frequency as Frequency) : 0;
    const s = r.startMonth ?? startMonth;
    return { cents: monthly, startMonth: s, endMonth: addMonths(s, r.months - 1), contributionId: r.contributionId };
  });
  // A redirected spending-account contribution frees budget too; a payroll one does not touch cash flow,
  // but the money still lands on the debt (it is treated as debt-paydown income for the window).
  const budget = computeBudget(startMonth, data.incomes, data.expenses, data.contributions, overrides.expenseCuts);
  const redirectedSavings = redirectExtras.reduce((s, r) => {
    const c = data.contributions.find((x) => x.id === r.contributionId);
    return c?.source === "SPENDING_ACCOUNT" ? s + r.cents : s;
  }, 0);

  const extras: PayoffInput["extras"] = [];
  if (overrides.extraMonthly && overrides.extraMonthly.cents > 0) {
    extras.push({
      cents: overrides.extraMonthly.cents,
      startMonth: overrides.extraMonthly.startMonth ?? null,
      endMonth: overrides.extraMonthly.endMonth ?? null,
    });
  }
  for (const r of redirectExtras) {
    const c = data.contributions.find((x) => x.id === r.contributionId);
    if (c?.source === "SPENDING_ACCOUNT") extras.push({ cents: r.cents, startMonth: r.startMonth, endMonth: r.endMonth });
  }
  const payrollRedirects = redirectExtras.filter(
    (r) => data.contributions.find((x) => x.id === r.contributionId)?.source === "PAYROLL",
  );

  const lumpSums: LumpSum[] = [
    ...scheduleLumpSums(data.lumpSumSchedules, startMonth, horizon, overrides),
    ...overrides.lumpSums.map((l) => ({ month: l.month, cents: l.cents, label: l.label, kind: "oneoff" as const })),
    ...(opts.withBonuses ? bonusLumpSums(data.bonuses, startMonth) : []),
  ];
  // Payroll redirects are added month by month as lump sums so they do not change the spending account.
  // A stopped RRSP payroll deduction raises net pay by only (1 − marginal rate) of the gross amount.
  for (const r of payrollRedirects) {
    const c = data.contributions.find((x) => x.id === r.contributionId);
    const acct = c ? data.accounts.find((a) => a.id === c.accountId) : undefined;
    const net = netOfTax(r.cents, acct?.owner, acct?.type, data.settings.marginalRateBps);
    for (let m = r.startMonth; m <= r.endMonth; m = addMonths(m, 1)) {
      lumpSums.push({ month: m, cents: net, label: "Redirected payroll contribution (after tax)", kind: "oneoff" });
    }
  }

  const payoffInput: PayoffInput = {
    startMonth,
    debts: data.debts.map((d) => toDebtInput(d, overrides)),
    // The redirected spending-account savings are no longer spent on savings, so the surplus rises by that amount,
    // and the same amount is then paid as an extra: net zero on the account, positive on the debt.
    surplusExDebtCents: budget.surplusExDebtCents + redirectedSavings,
    debtPaydownIncomeCents: budget.debtPaydownIncomeCents,
    extras,
    lumpSums,
    strategy: overrides.strategy,
    rollDown: overrides.rollDown,
    horizonMonths: horizon,
  };
  const payoff = runPayoff(payoffInput);

  const investInput: InvestInput = {
    startMonth,
    months: investMonths,
    accounts: data.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      owner: a.owner,
      kind: a.type,
      parentId: a.parentId ?? null,
      balanceCents: a.balanceCents,
      returnBps: a.returnBps,
      includeInNetWorth: a.includeInNetWorth,
      contributions: contributionsForAccount(a.id, data.contributions, overrides),
    })),
    globalReturnBps: overrides.returnBps ?? null,
    pauses: overrides.contributionPause
      ? [
          {
            startMonth: overrides.contributionPause.startMonth ?? startMonth,
            endMonth: addMonths(overrides.contributionPause.startMonth ?? startMonth, overrides.contributionPause.months - 1),
          },
        ]
      : [],
    redirects: redirectExtras.map((r) => ({ contributionId: r.contributionId, startMonth: r.startMonth, endMonth: r.endMonth })),
    resp: { enabled: opts.respGrants ?? false, cesgReceivedCents: 0, qesiReceivedCents: 0, cesgThisYearCents: 0, qesiThisYearCents: 0 },
  };
  const invest = runInvest(investInput);

  // Net worth series: investments (included) − debts included in net worth (LOC, cards, car loans, other).
  const nwDebtIds = new Set(data.debts.filter((d) => d.includeInNetWorth && d.type !== "MORTGAGE").map((d) => d.id));
  const mortgage = data.debts.find((d) => d.type === "MORTGAGE");
  const netWorth = invest.months.map((im, i) => {
    const pm = payoff.months[Math.min(i, payoff.months.length - 1)];
    let debts = 0;
    let mort = 0;
    for (const [id, dm] of Object.entries(pm.debts)) {
      if (nwDebtIds.has(id)) debts += dm.closingCents;
      if (mortgage && id === mortgage.id) mort = dm.closingCents;
    }
    const cents = im.includedCents - debts;
    return { month: im.month, cents, withHomeCents: cents + data.settings.homeValueCents - mort };
  });

  const includedNow = data.accounts.filter((a) => a.includeInNetWorth).reduce((s, a) => s + a.balanceCents, 0);
  const debtsNow = data.debts.filter((d) => nwDebtIds.has(d.id)).reduce((s, d) => s + d.balanceCents, 0);
  const consumerDebt = data.debts.filter((d) => d.includeInPayoff).reduce((s, d) => s + d.balanceCents, 0);

  return {
    budget,
    payoff,
    invest,
    payoffInput,
    investInput,
    netWorth,
    currentNetWorthCents: includedNow - debtsNow,
    currentNetWorthWithHomeCents: includedNow - debtsNow + data.settings.homeValueCents - (mortgage?.balanceCents ?? 0),
    consumerDebtCents: consumerDebt,
  };
}
