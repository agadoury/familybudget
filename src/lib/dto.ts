/** Serializable row shapes passed from server components to client components. */
import type { Frequency } from "@/lib/frequency";

export const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export interface IncomeDTO {
  id: string;
  person: "ALEX" | "SELIA" | null;
  name: string;
  amountCents: number;
  frequency: Frequency;
  destination: "SPENDING_ACCOUNT" | "RRSP" | "STOCK_PLAN" | "TFSA" | "DEBT_PAYDOWN" | "OTHER";
  startDate: string;
  endDate: string | null;
  notes: string | null;
  investmentAccountId: string | null;
}

export interface ExpenseDTO {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  frequency: Frequency;
  type: "FIXED" | "FLEXIBLE" | "SAVINGS";
  owner: "SHARED" | "ALEX" | "SELIA";
  essential: boolean;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

export interface ContributionDTO {
  id: string;
  accountId: string;
  amountCents: number;
  frequency: Frequency;
  source: "PAYROLL" | "SPENDING_ACCOUNT" | "LUMP_SUM";
  startDate: string;
  endDate: string | null;
  incomeId: string | null;
  notes: string | null;
}

export interface AccountDTO {
  id: string;
  owner: "ALEX" | "SELIA" | "JOINT";
  name: string;
  type: "RRSP" | "TFSA" | "RESP" | "NON_REGISTERED" | "STOCK_PLAN" | "CASH";
  subType: string | null;
  parentId: string | null;
  balanceCents: number;
  balanceAsOf: string;
  returnBps: number;
  includeInNetWorth: boolean;
  notes: string | null;
}

export interface DebtDTO {
  id: string;
  name: string;
  type: "LOC" | "CREDIT_CARD" | "CAR_LOAN" | "LEASE" | "MORTGAGE" | "OTHER";
  balanceCents: number;
  balanceAsOf: string;
  priority: number;
  minimumType: "FIXED" | "PERCENT_OF_BALANCE" | "INTEREST_ONLY";
  minimumCents: number;
  minimumBps: number;
  minimumFloorCents: number;
  plannedExtraCents: number;
  endDate: string | null;
  amortizationMonths: number | null;
  renewalDate: string | null;
  includeInPayoff: boolean;
  includeInNetWorth: boolean;
  notes: string | null;
  rates: { id: string; effectiveDate: string; annualRateBps: number }[];
  currentRateBps: number;
  scheduledCents: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toIncomeDTO(r: any): IncomeDTO {
  return { id: r.id, person: r.person, name: r.name, amountCents: r.amountCents, frequency: r.frequency, destination: r.destination, startDate: iso(r.startDate)!, endDate: iso(r.endDate), notes: r.notes, investmentAccountId: r.investmentAccountId };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toExpenseDTO(r: any): ExpenseDTO {
  return { id: r.id, name: r.name, category: r.category, amountCents: r.amountCents, frequency: r.frequency, type: r.type, owner: r.owner, essential: r.essential, startDate: iso(r.startDate)!, endDate: iso(r.endDate), notes: r.notes };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toContributionDTO(r: any): ContributionDTO {
  return { id: r.id, accountId: r.accountId, amountCents: r.amountCents, frequency: r.frequency, source: r.source, startDate: iso(r.startDate)!, endDate: iso(r.endDate), incomeId: r.incomeId, notes: r.notes };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAccountDTO(r: any): AccountDTO {
  return { id: r.id, owner: r.owner, name: r.name, type: r.type, subType: r.subType, parentId: r.parentId, balanceCents: r.balanceCents, balanceAsOf: iso(r.balanceAsOf)!, returnBps: r.returnBps, includeInNetWorth: r.includeInNetWorth, notes: r.notes };
}
