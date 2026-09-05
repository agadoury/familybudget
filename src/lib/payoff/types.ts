import type { MonthKey } from "@/lib/frequency";

export type Strategy = "AVALANCHE" | "SNOWBALL" | "LOC_FIRST";
export const STRATEGIES: Strategy[] = ["AVALANCHE", "SNOWBALL", "LOC_FIRST"];

export type DebtKind = "LOC" | "CREDIT_CARD" | "CAR_LOAN" | "LEASE" | "MORTGAGE" | "OTHER";

/** A rate in force from `month` (inclusive) until the next point. */
export interface RatePoint {
  month: MonthKey;
  annualRateBps: number;
}

export type MinimumRule =
  | { type: "FIXED"; cents: number }
  | { type: "PERCENT_OF_BALANCE"; bps: number; floorCents: number }
  | { type: "INTEREST_ONLY" };

export interface DebtInput {
  id: string;
  name: string;
  kind: DebtKind;
  balanceCents: number;
  rates: RatePoint[];
  minimum: MinimumRule;
  /** Lower = earlier when strategies tie. */
  priority: number;
  /** Scheduled payment stops after this month (car loans, leases). */
  endMonth?: MonthKey | null;
  /** Receives extra payments and counts toward the payoff date (LOC, cards). */
  includeInPayoff: boolean;
  /** The revolving account that grows when the budget is in deficit (the LOC). */
  absorbsDeficit?: boolean;
}

export type LumpSumKind = "scheduled" | "oneoff" | "bonus";

export interface LumpSum {
  month: MonthKey;
  cents: number;
  label: string;
  kind: LumpSumKind;
}

export interface ExtraPayment {
  cents: number;
  startMonth?: MonthKey | null;
  endMonth?: MonthKey | null;
}

export interface PayoffInput {
  startMonth: MonthKey;
  debts: DebtInput[];
  /**
   * Monthly spending-account surplus BEFORE any debt payment:
   * inflow − fixed − flexible − savings. The engine computes each month's
   * scheduled debt payments itself so roll-down and shrinking minimums are consistent.
   */
  surplusExDebtCents: number;
  /** Monthly inflow that never touches the spending account and goes straight to debt (child care). */
  debtPaydownIncomeCents: number;
  extras: ExtraPayment[];
  lumpSums: LumpSum[];
  strategy: Strategy;
  /** When a scheduled payment ends or shrinks, send the freed amount to debt. */
  rollDown: boolean;
  horizonMonths?: number;
}

export interface DebtMonth {
  openingCents: number;
  interestCents: number;
  scheduledCents: number;
  extraCents: number;
  /** Deficit added to the balance this month (LOC only). */
  deficitCents: number;
  closingCents: number;
  rateBps: number;
}

export interface PayoffMonth {
  month: MonthKey;
  index: number;
  debts: Record<string, DebtMonth>;
  /** Consumer (includeInPayoff) totals. */
  consumerBalanceCents: number;
  totalBalanceCents: number;
  interestCents: number;
  principalCents: number;
  cumulativeInterestCents: number;
  scheduledCents: number;
  extraPoolCents: number;
  lumpSumCents: number;
  freedCents: number;
  /** Positive: cash left in the spending account this month. Negative: financed by the LOC. */
  netBudgetCents: number;
  /** Pool that had nowhere to go (all consumer debts at zero). */
  leftoverCents: number;
  events: string[];
}

export type PayoffOutcome =
  | { kind: "paid"; month: MonthKey; months: number }
  | { kind: "never"; growthPerYearCents: number; horizonMonths: number };

export interface PayoffResult {
  months: PayoffMonth[];
  outcome: PayoffOutcome;
  totalInterestCents: number;
  /** Interest on consumer debts only (what strategies change). */
  consumerInterestCents: number;
  interestByDebtCents: Record<string, number>;
  payoffMonthByDebt: Record<string, MonthKey | null>;
  /** Month-0 free cash flow (surplus − scheduled payments). */
  freeCashFlowCents: number;
  /** Month-0 scheduled payments (what the Budget page shows as committed debt). */
  scheduledMonth0Cents: number;
  /**
   * Month-0 extra payment that exceeds the budget's free cash flow (0 when the budget funds it).
   * Extras are modelled as new money; this number says how much of it the budget does not explain.
   */
  fundingGapCents: number;
  deficitFinanced: boolean;
  startMonth: MonthKey;
}
