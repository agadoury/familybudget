import type { MonthKey } from "@/lib/frequency";

export type AccountKind = "RRSP" | "TFSA" | "RESP" | "NON_REGISTERED" | "STOCK_PLAN" | "CASH";
export type AccountOwner = "ALEX" | "SELIA" | "JOINT";

export interface ContributionInput {
  id: string;
  monthlyCents: number;
  startMonth?: MonthKey | null;
  endMonth?: MonthKey | null;
}

export interface InvestAccountInput {
  id: string;
  name: string;
  owner: AccountOwner;
  kind: AccountKind;
  parentId?: string | null;
  balanceCents: number;
  /** Effective annual return in bps (600 = 6 %). Cash accounts should be 0. */
  returnBps: number;
  includeInNetWorth: boolean;
  contributions: ContributionInput[];
}

export interface Pause {
  startMonth: MonthKey;
  endMonth: MonthKey;
  /** null/undefined = all accounts. */
  accountId?: string | null;
}

export interface Redirect {
  contributionId: string;
  startMonth: MonthKey;
  endMonth: MonthKey;
}

export interface RespGrantState {
  enabled: boolean;
  /** Lifetime grant already received (caps are 7 200 $ CESG, 3 600 $ QESI). */
  cesgReceivedCents: number;
  qesiReceivedCents: number;
  /** Grant already received in the start year (so the annual cap is respected mid-year). */
  cesgThisYearCents: number;
  qesiThisYearCents: number;
}

export interface InvestInput {
  startMonth: MonthKey;
  months: number;
  accounts: InvestAccountInput[];
  /** Override every account's return (bps). */
  globalReturnBps?: number | null;
  pauses: Pause[];
  redirects: Redirect[];
  resp: RespGrantState;
}

export interface InvestMonth {
  month: MonthKey;
  balances: Record<string, number>;
  contributionsCents: number;
  grantsCents: number;
  totalCents: number;
  /** Sum of includeInNetWorth accounts. */
  includedCents: number;
}

export interface InvestResult {
  months: InvestMonth[];
  grantsByYear: { year: number; cesgCents: number; qesiCents: number }[];
  totalContributionsCents: number;
  totalGrantsCents: number;
  endBalances: Record<string, number>;
}
