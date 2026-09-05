/** Serialize everything the client-side engines need (dates → ISO strings). */
import type { HouseholdData } from "@/lib/projection";
import { iso } from "@/lib/dto";

export type HouseholdDTO = {
  incomes: (Omit<HouseholdData["incomes"][number], "startDate" | "endDate"> & { startDate: string; endDate: string | null })[];
  expenses: (Omit<HouseholdData["expenses"][number], "startDate" | "endDate"> & { startDate: string; endDate: string | null; notes: string | null })[];
  contributions: (Omit<HouseholdData["contributions"][number], "startDate" | "endDate"> & { startDate: string; endDate: string | null; source: "PAYROLL" | "SPENDING_ACCOUNT" | "LUMP_SUM"; incomeId?: string | null })[];
  debts: (Omit<HouseholdData["debts"][number], "balanceAsOf" | "endDate" | "rates"> & {
    balanceAsOf: string;
    endDate: string | null;
    rates: { id: string; effectiveDate: string; annualRateBps: number }[];
    notes: string | null;
    plannedExtraCents: number;
    amortizationMonths: number | null;
    renewalDate: string | null;
  })[];
  lumpSumSchedules: (Omit<HouseholdData["lumpSumSchedules"][number], "startDate" | "endDate"> & { startDate: string; endDate: string | null; notes: string | null; sourceIncomeId: string | null })[];
  accounts: (Omit<HouseholdData["accounts"][number], "balanceAsOf"> & { balanceAsOf: string; subType: string | null; notes: string | null })[];
  bonuses: (HouseholdData["bonuses"][number] & { debtPaymentId: string | null })[];
  settings: HouseholdData["settings"] & { defaultScenarioId: string | null; includeHomeEquity: boolean; alexName: string; seliaName: string; language: "EN" | "FR"; cashBufferCents: number; alexGrossIncomeCents: number; seliaGrossIncomeCents: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toHouseholdDTO(data: any): HouseholdDTO {
  return {
    incomes: data.incomes.map((r: any) => ({ id: r.id, person: r.person, name: r.name, amountCents: r.amountCents, frequency: r.frequency, destination: r.destination, startDate: iso(r.startDate)!, endDate: iso(r.endDate) })), // eslint-disable-line @typescript-eslint/no-explicit-any
    expenses: data.expenses.map((r: any) => ({ id: r.id, name: r.name, category: r.category, amountCents: r.amountCents, frequency: r.frequency, type: r.type, owner: r.owner, essential: r.essential, startDate: iso(r.startDate)!, endDate: iso(r.endDate), notes: r.notes })), // eslint-disable-line @typescript-eslint/no-explicit-any
    contributions: data.contributions.map((r: any) => ({ id: r.id, accountId: r.accountId, amountCents: r.amountCents, frequency: r.frequency, source: r.source, startDate: iso(r.startDate)!, endDate: iso(r.endDate), incomeId: r.incomeId })), // eslint-disable-line @typescript-eslint/no-explicit-any
    debts: data.debts.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: r.id, name: r.name, type: r.type, balanceCents: r.balanceCents, balanceAsOf: iso(r.balanceAsOf)!, priority: r.priority,
      minimumType: r.minimumType, minimumCents: r.minimumCents, minimumBps: r.minimumBps, minimumFloorCents: r.minimumFloorCents,
      plannedExtraCents: r.plannedExtraCents, endDate: iso(r.endDate), amortizationMonths: r.amortizationMonths, renewalDate: iso(r.renewalDate),
      includeInPayoff: r.includeInPayoff, includeInNetWorth: r.includeInNetWorth, notes: r.notes,
      rates: r.rates.map((x: any) => ({ id: x.id, effectiveDate: iso(x.effectiveDate)!, annualRateBps: x.annualRateBps })), // eslint-disable-line @typescript-eslint/no-explicit-any
    })),
    lumpSumSchedules: data.lumpSumSchedules.map((r: any) => ({ id: r.id, name: r.name, amountCents: r.amountCents, months: r.months, startDate: iso(r.startDate)!, endDate: iso(r.endDate), active: r.active, notes: r.notes, sourceIncomeId: r.sourceIncomeId })), // eslint-disable-line @typescript-eslint/no-explicit-any
    accounts: data.accounts.map((r: any) => ({ id: r.id, name: r.name, owner: r.owner, type: r.type, subType: r.subType, parentId: r.parentId, balanceCents: r.balanceCents, balanceAsOf: iso(r.balanceAsOf)!, returnBps: r.returnBps, includeInNetWorth: r.includeInNetWorth, notes: r.notes })), // eslint-disable-line @typescript-eslint/no-explicit-any
    bonuses: data.bonuses.map((r: any) => ({ id: r.id, person: r.person, amountCents: r.amountCents, expectedYear: r.expectedYear, expectedMonth: r.expectedMonth, confidence: r.confidence, pctAppliedBps: r.pctAppliedBps, debtPaymentId: r.debtPaymentId })), // eslint-disable-line @typescript-eslint/no-explicit-any
    settings: {
      defaultReturnBps: data.settingsRow.defaultReturnBps,
      homeValueCents: data.settingsRow.homeValueCents,
      cashBufferCents: data.settingsRow.cashBufferCents,
      defaultScenarioId: data.settingsRow.defaultScenarioId,
      includeHomeEquity: data.settingsRow.includeHomeEquity,
      alexName: data.settingsRow.alexName,
      seliaName: data.settingsRow.seliaName,
      language: data.settingsRow.language,
      alexGrossIncomeCents: data.settingsRow.alexGrossIncomeCents,
      seliaGrossIncomeCents: data.settingsRow.seliaGrossIncomeCents,
      marginalRateBps: data.settings.marginalRateBps,
    },
  };
}

export interface ScenarioDTO {
  id: string;
  name: string;
  description: string | null;
  isBaseline: boolean;
  overrides: import("@/lib/payoff").ScenarioOverrides;
}

export interface SnapshotDTO {
  id: string;
  month: string; // YYYY-MM
  note: string | null;
  projectedPayoffMonth: string | null;
  projectedInterestCents: number | null;
  netWorthCents: number | null;
  debts: { debtId: string; balanceCents: number }[];
  accounts: { accountId: string; balanceCents: number }[];
  spend: { category: string; amountCents: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSnapshotDTO(s: any): SnapshotDTO {
  return {
    id: s.id,
    month: iso(s.month)!.slice(0, 7),
    note: s.note,
    projectedPayoffMonth: s.projectedPayoffMonth ? iso(s.projectedPayoffMonth)!.slice(0, 7) : null,
    projectedInterestCents: s.projectedInterestCents,
    netWorthCents: s.netWorthCents,
    debts: s.debts.map((d: any) => ({ debtId: d.debtId, balanceCents: d.balanceCents })), // eslint-disable-line @typescript-eslint/no-explicit-any
    accounts: s.accounts.map((a: any) => ({ accountId: a.accountId, balanceCents: a.balanceCents })), // eslint-disable-line @typescript-eslint/no-explicit-any
    spend: s.spend.map((x: any) => ({ category: x.category, amountCents: x.amountCents })), // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}
