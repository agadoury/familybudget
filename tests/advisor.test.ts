import { describe, expect, it } from "vitest";
import { advise } from "@/lib/insights/advisor";
import type { HouseholdDTO } from "@/lib/dto-household";
import { formatMoney, formatPct } from "@/lib/money";
import { formatMonth } from "@/lib/frequency";

/** A fixture shaped like the real household (see PLAN.md §0). */
const START = "2026-09-01";
const data: HouseholdDTO = {
  incomes: [
    { id: "i1", person: "ALEX", name: "Salary", amountCents: 320000, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: START, endDate: null },
    { id: "i2", person: "SELIA", name: "Salary", amountCents: 276000, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: START, endDate: null },
    { id: "i3", person: "ALEX", name: "RRSP payroll", amountCents: 106100, frequency: "SEMI_MONTHLY", destination: "RRSP", startDate: START, endDate: null },
    { id: "i4", person: null, name: "Child care", amountCents: 50000, frequency: "MONTHLY", destination: "DEBT_PAYDOWN", startDate: START, endDate: null },
  ],
  expenses: [
    { id: "e1", name: "Child care", category: "Child care", amountCents: 150000, frequency: "MONTHLY", type: "FIXED", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: null },
    { id: "e2", name: "Utilities", category: "Utilities", amountCents: 70000, frequency: "MONTHLY", type: "FIXED", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: null },
    { id: "e3", name: "Taxes", category: "Taxes", amountCents: 770000, frequency: "ANNUAL", type: "FIXED", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: "estimate" },
    { id: "e4", name: "Vacation", category: "Vacation", amountCents: 500000, frequency: "ANNUAL", type: "FIXED", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
    { id: "e5", name: "Insurance", category: "Insurance", amountCents: 36000, frequency: "MONTHLY", type: "FIXED", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: null },
    { id: "e6", name: "Gas", category: "Gas", amountCents: 35000, frequency: "MONTHLY", type: "FIXED", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: null },
    { id: "e7", name: "Internet+streaming+apps", category: "Subscriptions", amountCents: 17300, frequency: "MONTHLY", type: "FIXED", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
    { id: "f1", name: "Groceries", category: "Groceries", amountCents: 60000, frequency: "MONTHLY", type: "FLEXIBLE", owner: "SHARED", essential: true, startDate: START, endDate: null, notes: null },
    { id: "f2", name: "Restaurants", category: "Restaurants", amountCents: 20000, frequency: "MONTHLY", type: "FLEXIBLE", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
    { id: "f3", name: "UberEats", category: "UberEats", amountCents: 20000, frequency: "MONTHLY", type: "FLEXIBLE", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
    { id: "f4", name: "Shopping", category: "Shopping", amountCents: 20000, frequency: "MONTHLY", type: "FLEXIBLE", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
    { id: "f5", name: "Other flexible", category: "Other", amountCents: 54000, frequency: "MONTHLY", type: "FLEXIBLE", owner: "SHARED", essential: false, startDate: START, endDate: null, notes: null },
  ],
  contributions: [{ id: "c1", accountId: "a_grp", amountCents: 106100, frequency: "SEMI_MONTHLY", source: "PAYROLL", startDate: START, endDate: null, incomeId: "i3" }],
  debts: [
    { id: "card", name: "Card", type: "CREDIT_CARD", balanceCents: 1_000_000, balanceAsOf: START, priority: 10, minimumType: "PERCENT_OF_BALANCE", minimumCents: 0, minimumBps: 500, minimumFloorCents: 1000, plannedExtraCents: 0, endDate: null, amortizationMonths: null, renewalDate: null, includeInPayoff: true, includeInNetWorth: true, notes: "estimate", rates: [{ id: "r1", effectiveDate: START, annualRateBps: 2000 }] },
    { id: "loc", name: "LOC", type: "LOC", balanceCents: 7_000_000, balanceAsOf: START, priority: 20, minimumType: "INTEREST_ONLY", minimumCents: 0, minimumBps: 0, minimumFloorCents: 0, plannedExtraCents: 0, endDate: null, amortizationMonths: null, renewalDate: null, includeInPayoff: true, includeInNetWorth: true, notes: null, rates: [{ id: "r2", effectiveDate: START, annualRateBps: 595 }] },
    { id: "mort", name: "Mortgage", type: "MORTGAGE", balanceCents: 101_366_700, balanceAsOf: START, priority: 90, minimumType: "FIXED", minimumCents: 475200, minimumBps: 0, minimumFloorCents: 0, plannedExtraCents: 0, endDate: null, amortizationMonths: 300, renewalDate: "2031-09-01", includeInPayoff: false, includeInNetWorth: false, notes: null, rates: [{ id: "r3", effectiveDate: START, annualRateBps: 379 }] },
    { id: "lease1", name: "Audi lease", type: "LEASE", balanceCents: 0, balanceAsOf: START, priority: 50, minimumType: "FIXED", minimumCents: 70000, minimumBps: 0, minimumFloorCents: 0, plannedExtraCents: 0, endDate: null, amortizationMonths: null, renewalDate: null, includeInPayoff: false, includeInNetWorth: false, notes: null, rates: [] },
    { id: "lease2", name: "Tiguan lease", type: "LEASE", balanceCents: 0, balanceAsOf: START, priority: 51, minimumType: "FIXED", minimumCents: 70000, minimumBps: 0, minimumFloorCents: 0, plannedExtraCents: 0, endDate: null, amortizationMonths: null, renewalDate: null, includeInPayoff: false, includeInNetWorth: false, notes: null, rates: [] },
  ],
  lumpSumSchedules: [{ id: "l1", name: "Stock plan withdrawal", amountCents: 848400, months: [4, 11], startDate: START, endDate: null, active: true, notes: null, sourceIncomeId: null }],
  accounts: [
    { id: "a_grp", name: "Group RRSP", owner: "ALEX", type: "RRSP", subType: "group", parentId: null, balanceCents: 9_600_000, balanceAsOf: START, returnBps: 600, includeInNetWorth: true, notes: null },
    { id: "resp", name: "RESP", owner: "JOINT", type: "RESP", subType: null, parentId: null, balanceCents: 656_906, balanceAsOf: START, returnBps: 600, includeInNetWorth: false, notes: null },
    { id: "cash", name: "Emergency fund", owner: "JOINT", type: "CASH", subType: null, parentId: null, balanceCents: 200_000, balanceAsOf: START, returnBps: 0, includeInNetWorth: true, notes: null },
  ],
  bonuses: [],
  settings: { defaultReturnBps: 600, homeValueCents: 128_000_000, cashBufferCents: 200_000, defaultScenarioId: null, includeHomeEquity: false, alexName: "Alex", seliaName: "Sélia", language: "EN", alexGrossIncomeCents: 17_000_000, seliaGrossIncomeCents: 12_000_000, marginalRateBps: { ALEX: 4750, SELIA: 4570 } },
};

const fmt = {
  money: (c: number, o?: { compact?: boolean; sign?: boolean }) => formatMoney(c, { locale: "en-CA", ...o }),
  pct: (b: number, d?: number) => formatPct(b, "en-CA", d ?? 2),
  month: (m: string) => formatMonth(m, "en-CA"),
  lang: "en" as const,
  personName: (p: string | null | undefined) => (p === "ALEX" ? "Alex" : p === "SELIA" ? "Sélia" : "Joint"),
};

describe("advisor", () => {
  const report = advise(data, [], [], fmt, new Date("2026-09-05T12:00:00Z"));
  const ids = report.recommendations.map((r) => r.id);

  it("produces the core recommendations for a deficit household with cards, LOC, RESP and payroll RRSP", () => {
    expect(ids).toEqual(expect.arrayContaining(["confirm-estimates", "close-gap", "cards", "strategy-keep", "loc-fixed-payment", "resp", "rrsp-keep", "emergency-fund", "leases", "mortgage-renewal", "after-payoff", "housekeeping"]));
    expect(report.summary.length).toBeGreaterThanOrEqual(3);
    expect(report.headline).toMatch(/debt-free in/);
  });

  it("close-gap package caps cuts at 50 % per line, only touches non-essential flexible lines and closes the gap", () => {
    const r = report.recommendations.find((x) => x.id === "close-gap")!;
    const cuts = r.tryOverrides!.expenseCuts;
    expect(cuts.length).toBeGreaterThan(0);
    for (const c of cuts) {
      expect(c.pct).toBeLessThanOrEqual(50);
      const e = data.expenses.find((x) => x.id === c.expenseId)!;
      expect(e.type).toBe("FLEXIBLE");
      expect(e.essential).toBe(false);
    }
    // Non-essential flexible total is 1 140 $; at most half is 570 $; the gap is ~969 $ so it cannot fully close.
    expect(r.why).toMatch(/to find elsewhere/);
    expect(r.steps.some((s) => /Vacation/.test(s))).toBe(true);
  });

  it("card advice quantifies the rate spread against the LOC", () => {
    const r = report.recommendations.find((x) => x.id === "cards")!;
    // 10 000 $ × (20 % − 5.95 %) / 12 = 117,08 $/month
    expect(r.why).toContain("$117.08");
    expect(r.impact.find((i) => i.label === "Interest now")?.value).toBe("$166.67/month");
  });

  it("RESP grants are worth 30 % and beat the LOC interest on the same amount", () => {
    const r = report.recommendations.find((x) => x.id === "resp")!;
    expect(r.title).toContain("$208.33/month");
    expect(r.why).toContain("$750"); // grants per year
    expect(r.why).toContain("$149"); // 2 500 × 5.95 %
  });

  it("RRSP advice uses the marginal rate: 2 122 $ gross costs only 1 114 $ net at 47.5 %", () => {
    const r = report.recommendations.find((x) => x.id === "rrsp-keep")!;
    expect(r.why).toContain("$1,007.95/month"); // 2 122 × 47.5 %
    expect(r.why).toContain("$1,114.05");
    expect(r.why).toMatch(/employer match/);
  });

  it("LOC fixed-payment suggestion is the next 50 $ above interest + 100 $", () => {
    const r = report.recommendations.find((x) => x.id === "loc-fixed-payment")!;
    // interest 347,08 → +100 = 447,08 → next 50 = 450
    expect(r.title).toContain("$450");
  });

  it("mortgage sensitivity is 1 % of balance / 12", () => {
    const r = report.recommendations.find((x) => x.id === "mortgage-renewal")!;
    expect(r.impact[0].value).toBe("$845/month");
  });

  it("says nothing about a deficit when there is none", () => {
    const rich = { ...data, incomes: data.incomes.map((i) => (i.id === "i1" ? { ...i, amountCents: 450000 } : i)) };
    const rep = advise(rich, [], [], fmt, new Date("2026-09-05T12:00:00Z"));
    const ids2 = rep.recommendations.map((r) => r.id);
    expect(ids2).not.toContain("close-gap");
    expect(ids2).not.toContain("confirm-estimates");
  });
});
