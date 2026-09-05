import { z } from "zod";

export const person = z.enum(["ALEX", "SELIA"]);
export const owner = z.enum(["SHARED", "ALEX", "SELIA"]);
export const accountOwner = z.enum(["ALEX", "SELIA", "JOINT"]);
export const frequency = z.enum(["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]);
export const incomeDestination = z.enum(["SPENDING_ACCOUNT", "RRSP", "STOCK_PLAN", "TFSA", "DEBT_PAYDOWN", "OTHER"]);
export const expenseType = z.enum(["FIXED", "FLEXIBLE", "SAVINGS"]);
export const debtType = z.enum(["LOC", "CREDIT_CARD", "CAR_LOAN", "LEASE", "MORTGAGE", "OTHER"]);
export const minimumType = z.enum(["FIXED", "PERCENT_OF_BALANCE", "INTEREST_ONLY"]);
export const paymentType = z.enum(["MINIMUM", "EXTRA", "LUMP_SUM"]);
export const accountType = z.enum(["RRSP", "TFSA", "RESP", "NON_REGISTERED", "STOCK_PLAN", "CASH"]);
export const contributionSource = z.enum(["PAYROLL", "SPENDING_ACCOUNT", "LUMP_SUM"]);

export const cents = z.number().int().min(0).max(1_000_000_000_00);
export const signedCents = z.number().int().min(-1_000_000_000_00).max(1_000_000_000_00);
export const bps = z.number().int().min(0).max(100_000);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const isoDateOpt = isoDate.nullable().optional();
export const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const incomeSchema = z.object({
  person: person.nullable(),
  name: z.string().trim().min(1).max(80),
  amountCents: cents,
  frequency,
  destination: incomeDestination,
  startDate: isoDate,
  endDate: isoDateOpt,
  notes: z.string().max(500).nullable().optional(),
  investmentAccountId: z.string().nullable().optional(),
});
export type IncomeInput = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  amountCents: cents,
  frequency,
  type: expenseType,
  owner,
  essential: z.boolean(),
  startDate: isoDate,
  endDate: isoDateOpt,
  notes: z.string().max(500).nullable().optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const contributionSchema = z.object({
  accountId: z.string().min(1),
  amountCents: cents,
  frequency,
  source: contributionSource,
  startDate: isoDate,
  endDate: isoDateOpt,
  notes: z.string().max(500).nullable().optional(),
});
export type ContributionInput = z.infer<typeof contributionSchema>;

export const debtSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: debtType,
  balanceCents: cents,
  balanceAsOf: isoDate,
  priority: z.number().int().min(0).max(1000),
  minimumType,
  minimumCents: cents,
  minimumBps: bps,
  minimumFloorCents: cents,
  plannedExtraCents: cents,
  endDate: isoDateOpt,
  amortizationMonths: z.number().int().min(1).max(600).nullable().optional(),
  renewalDate: isoDateOpt,
  includeInPayoff: z.boolean(),
  includeInNetWorth: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
  /** Current annual rate; a new DebtRate row is added when it changes. */
  annualRateBps: bps,
  rateEffectiveDate: isoDate.optional(),
});
export type DebtInputForm = z.infer<typeof debtSchema>;

export const debtRateSchema = z.object({ debtId: z.string(), effectiveDate: isoDate, annualRateBps: bps, note: z.string().max(200).optional() });

export const debtPaymentSchema = z.object({
  debtId: z.string(),
  date: isoDate,
  amountCents: cents,
  type: paymentType,
  note: z.string().max(200).nullable().optional(),
});

export const lumpSumScheduleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountCents: cents,
  months: z.array(z.number().int().min(1).max(12)).min(1),
  startDate: isoDate,
  endDate: isoDateOpt,
  sourceIncomeId: z.string().nullable().optional(),
  active: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});

export const accountSchema = z.object({
  owner: accountOwner,
  name: z.string().trim().min(1).max(80),
  type: accountType,
  subType: z.string().max(40).nullable().optional(),
  parentId: z.string().nullable().optional(),
  balanceCents: cents,
  balanceAsOf: isoDate,
  returnBps: z.number().int().min(0).max(5000),
  includeInNetWorth: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const contributionRoomSchema = z.object({
  person,
  accountType: z.enum(["TFSA", "RRSP"]),
  roomCents: cents,
  asOf: isoDate,
  notes: z.string().max(200).nullable().optional(),
});

export const scenarioSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  overrides: z.unknown(),
});

export const bonusSchema = z.object({
  person,
  amountCents: cents,
  expectedYear: z.number().int().min(2020).max(2100),
  expectedMonth: z.number().int().min(1).max(12),
  confidence: z.enum(["UNCONFIRMED", "CONFIRMED"]),
  pctAppliedBps: z.number().int().min(0).max(10_000),
});

export const settingsSchema = z.object({
  alexName: z.string().trim().min(1).max(40),
  seliaName: z.string().trim().min(1).max(40),
  language: z.enum(["EN", "FR"]),
  defaultScenarioId: z.string().nullable().optional(),
  defaultReturnBps: z.number().int().min(0).max(5000),
  homeValueCents: cents,
  cashBufferCents: cents,
  includeHomeEquity: z.boolean(),
});

export const snapshotSchema = z.object({
  month: monthKey,
  note: z.string().max(1000).nullable().optional(),
  debts: z.array(z.object({ debtId: z.string(), balanceCents: cents })),
  accounts: z.array(z.object({ accountId: z.string(), balanceCents: cents })),
  spend: z.array(z.object({ category: z.string().min(1), amountCents: cents })),
  lumpSums: z.array(
    z.object({ debtId: z.string(), amountCents: cents, note: z.string().max(200).optional(), bonusId: z.string().optional() }),
  ),
});
export type SnapshotInput = z.infer<typeof snapshotSchema>;
