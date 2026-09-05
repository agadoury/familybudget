/** Plain data consumed by applySeed(). Amounts in dollars here for readability; converted to cents on insert. */
export type P = "ALEX" | "SELIA";

export interface SeedData {
  settings: {
    alexName: string;
    seliaName: string;
    homeValue: number;
    cashBuffer: number;
    defaultReturnPct: number;
  };
  accounts: {
    key: string;
    owner: "ALEX" | "SELIA" | "JOINT";
    name: string;
    type: "RRSP" | "TFSA" | "RESP" | "NON_REGISTERED" | "STOCK_PLAN" | "CASH";
    subType?: string;
    parentKey?: string;
    balance: number;
    asOf: string;
    returnPct?: number;
    includeInNetWorth?: boolean;
    notes?: string;
  }[];
  incomes: {
    key: string;
    person: P | null;
    name: string;
    amount: number;
    frequency: "SEMI_MONTHLY" | "MONTHLY" | "ANNUAL" | "ONE_TIME";
    destination: "SPENDING_ACCOUNT" | "RRSP" | "STOCK_PLAN" | "TFSA" | "DEBT_PAYDOWN" | "OTHER";
    accountKey?: string;
    startDate: string;
    notes?: string;
  }[];
  expenses: {
    name: string;
    category: string;
    amount: number;
    frequency: "WEEKLY" | "BI_WEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";
    type: "FIXED" | "FLEXIBLE" | "SAVINGS";
    owner?: "SHARED" | "ALEX" | "SELIA";
    essential?: boolean;
    startDate: string;
    notes?: string;
  }[];
  debts: {
    key: string;
    name: string;
    type: "LOC" | "CREDIT_CARD" | "CAR_LOAN" | "LEASE" | "MORTGAGE" | "OTHER";
    balance: number;
    asOf: string;
    ratePct: number;
    rateSince: string;
    minimum:
      | { type: "FIXED"; amount: number }
      | { type: "PERCENT_OF_BALANCE"; pct: number; floor: number }
      | { type: "INTEREST_ONLY" };
    priority: number;
    endDate?: string;
    amortizationMonths?: number;
    renewalDate?: string;
    includeInPayoff: boolean;
    includeInNetWorth: boolean;
    notes?: string;
  }[];
  lumpSumSchedules: {
    name: string;
    amount: number;
    months: number[];
    startDate: string;
    sourceIncomeKey?: string;
    notes?: string;
  }[];
  contributions: {
    accountKey: string;
    amount: number;
    frequency: "WEEKLY" | "BI_WEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";
    source: "SPENDING_ACCOUNT" | "LUMP_SUM";
    startDate: string;
    notes?: string;
  }[];
  contributionRoom: { person: P; accountType: "TFSA" | "RRSP"; room: number; asOf: string; notes?: string }[];
  scenarios: { name: string; description?: string; isBaseline?: boolean; overrides: Record<string, unknown> }[];
  bonuses: { person: P; amount: number; year: number; month: number }[];
  /** Optional past check-ins so plan-vs-actual has something to show (demo). */
  snapshots?: {
    month: string;
    note?: string;
    debts: { debtKey: string; balance: number }[];
    accounts: { accountKey: string; balance: number }[];
    spend: { category: string; amount: number }[];
  }[];
}
