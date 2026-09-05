import { describe, expect, it } from "vitest";
import { runPayoff, solveExtraForTarget, rateForMonth, type DebtInput, type PayoffInput } from "@/lib/payoff";

const START = "2026-09";

function loc(over: Partial<DebtInput> = {}): DebtInput {
  return {
    id: "loc",
    name: "LOC",
    kind: "LOC",
    balanceCents: 70_000_00,
    rates: [{ month: "2000-01", annualRateBps: 595 }],
    minimum: { type: "INTEREST_ONLY" },
    priority: 10,
    includeInPayoff: true,
    absorbsDeficit: true,
    ...over,
  };
}

function base(over: Partial<PayoffInput> = {}): PayoffInput {
  return {
    startMonth: START,
    debts: [loc()],
    surplusExDebtCents: 0,
    debtPaydownIncomeCents: 0,
    extras: [],
    lumpSums: [],
    strategy: "AVALANCHE",
    rollDown: true,
    horizonMonths: 120,
    ...over,
  };
}

describe("payoff engine", () => {
  it("interest-only minimum: principal never moves, outcome is never", () => {
    // 70 000 $ × 5.95 % / 12 = 347,08 $ interest per month; minimum = interest.
    const r = runPayoff(base({ surplusExDebtCents: 347_08 }));
    expect(r.months[0].debts.loc.interestCents).toBe(347_08);
    expect(r.months[0].debts.loc.scheduledCents).toBe(347_08);
    expect(r.months[0].debts.loc.closingCents).toBe(70_000_00);
    expect(r.months[119].debts.loc.closingCents).toBe(70_000_00);
    expect(r.outcome.kind).toBe("never");
    if (r.outcome.kind === "never") expect(r.outcome.growthPerYearCents).toBe(0);
    expect(r.freeCashFlowCents).toBe(0);
  });

  it("negative free cash flow: the LOC grows by the shortfall every month", () => {
    // Hand-computed: 10 000 $ at 6 %, interest-only, budget short 400 $/month before interest.
    // M1: interest 50,00 → net budget −450 → balance 10 450,00
    // M2: interest 52,25 → net budget −452,25 → balance 10 902,25
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 10_000_00, rates: [{ month: "2000-01", annualRateBps: 600 }] })],
        surplusExDebtCents: -400_00,
      }),
    );
    expect(r.months[0].debts.loc.interestCents).toBe(50_00);
    expect(r.months[0].netBudgetCents).toBe(-450_00);
    expect(r.months[0].debts.loc.deficitCents).toBe(450_00);
    expect(r.months[0].debts.loc.closingCents).toBe(10_450_00);
    expect(r.months[1].debts.loc.closingCents).toBe(10_902_25);
    expect(r.deficitFinanced).toBe(true);
    expect(r.outcome.kind).toBe("never");
    if (r.outcome.kind === "never") expect(r.outcome.growthPerYearCents).toBeGreaterThan(0);
  });

  it("fixed payment amortization matches the hand-computed schedule", () => {
    // 1 200 $ at 12 % (1 %/month), 100 $/month:
    // M1 interest 12,00 → 1 112,00; M2 11,12 → 1 023,12; M3 10,23 → 933,35; ... paid in month 13, total interest 84,78 $.
    const r = runPayoff(
      base({
        debts: [
          loc({
            balanceCents: 1_200_00,
            rates: [{ month: "2000-01", annualRateBps: 1200 }],
            minimum: { type: "FIXED", cents: 100_00 },
          }),
        ],
        surplusExDebtCents: 100_00,
      }),
    );
    expect(r.months[0].debts.loc.interestCents).toBe(12_00);
    expect(r.months[0].debts.loc.closingCents).toBe(1_112_00);
    expect(r.months[1].debts.loc.closingCents).toBe(1_023_12);
    expect(r.months[2].debts.loc.closingCents).toBe(933_35);
    expect(r.outcome).toEqual({ kind: "paid", month: "2027-09", months: 13 });
    expect(r.totalInterestCents).toBe(84_78);
  });

  it("semi-annual lump sums (April & November) clear the balance; leftover is reported", () => {
    // 20 000 $ at 0 %, no minimum, 8 484 $ every April and November from Sept 2026:
    // Apr 2027 → 11 516; Nov 2027 → 3 032; Apr 2028 → 0 with 5 452 left over. 20 months.
    const lumps = ["2027-04", "2027-11", "2028-04", "2028-11"].map((month) => ({
      month,
      cents: 8_484_00,
      label: "Stock plan",
      kind: "scheduled" as const,
    }));
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 20_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } })],
        lumpSums: lumps,
      }),
    );
    const byMonth = Object.fromEntries(r.months.map((m) => [m.month, m]));
    expect(byMonth["2027-04"].debts.loc.closingCents).toBe(11_516_00);
    expect(byMonth["2027-11"].debts.loc.closingCents).toBe(3_032_00);
    expect(byMonth["2028-04"].debts.loc.closingCents).toBe(0);
    expect(byMonth["2028-04"].leftoverCents).toBe(5_452_00);
    expect(r.outcome).toEqual({ kind: "paid", month: "2028-04", months: 20 });
  });

  it("variable rate change mid-plan uses the new rate from its effective month", () => {
    // 12 000 $, 1 000 $/month fixed. 12 % for Sept–Oct 2026, 24 % from Nov 2026.
    // M1 interest 120,00 → 11 120,00; M2 111,20 → 10 231,20; M3 (24 %) 204,62 → 9 435,82; paid month 14, interest 1 563,54.
    const d = loc({
      balanceCents: 12_000_00,
      rates: [
        { month: "2026-01", annualRateBps: 1200 },
        { month: "2026-11", annualRateBps: 2400 },
      ],
      minimum: { type: "FIXED", cents: 1_000_00 },
    });
    expect(rateForMonth(d, "2026-10")).toBe(1200);
    expect(rateForMonth(d, "2026-11")).toBe(2400);
    const r = runPayoff(base({ debts: [d], surplusExDebtCents: 1_000_00 }));
    expect(r.months[1].debts.loc.closingCents).toBe(10_231_20);
    expect(r.months[2].debts.loc.rateBps).toBe(2400);
    expect(r.months[2].debts.loc.interestCents).toBe(204_62);
    expect(r.months[2].debts.loc.closingCents).toBe(9_435_82);
    expect(r.outcome).toEqual({ kind: "paid", month: "2027-10", months: 14 });
    expect(r.totalInterestCents).toBe(1_563_54);
  });

  it("extra payment starting on a future date", () => {
    // 5 000 $ at 0 %, 100 $ minimum, +400 $/month from Dec 2026.
    // Sept–Nov: 100/month → 4 700. Dec onward: 500/month → paid in month 13 (Sept 2027) with 300 left over.
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 5_000_00, rates: [], minimum: { type: "FIXED", cents: 100_00 } })],
        surplusExDebtCents: 500_00,
        extras: [{ cents: 400_00, startMonth: "2026-12" }],
      }),
    );
    expect(r.months[2].debts.loc.closingCents).toBe(4_700_00);
    expect(r.months[2].debts.loc.extraCents).toBe(0);
    expect(r.months[3].debts.loc.extraCents).toBe(400_00);
    expect(r.months[3].debts.loc.closingCents).toBe(4_200_00);
    expect(r.outcome).toEqual({ kind: "paid", month: "2027-09", months: 13 });
    expect(r.months[12].leftoverCents).toBe(300_00);
  });

  it("reverse solver finds the exact monthly amount for a target date", () => {
    // 12 000 $ at 0 %, no minimum, debt-free by Aug 2027 (12 months) → exactly 1 000 $/month.
    const input = base({
      debts: [loc({ balanceCents: 12_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } })],
      surplusExDebtCents: 5_000_00,
    });
    const s = solveExtraForTarget(input, "2027-08");
    expect(s).not.toBeNull();
    expect(s!.extraCents).toBe(1_000_00);
    expect(s!.result.outcome).toEqual({ kind: "paid", month: "2027-08", months: 12 });
    expect(solveExtraForTarget(input, "2026-09", 1_000_00)).toBeNull();
  });

  it("percent-of-balance minimum with a floor", () => {
    // 5 000 $ card at 20 %, minimum 5 % of balance, floor 10 $.
    // M1: interest 83,33 → 5 083,33; minimum 254,17 → 4 829,16.
    const card: DebtInput = {
      id: "card",
      name: "Card",
      kind: "CREDIT_CARD",
      balanceCents: 5_000_00,
      rates: [{ month: "2000-01", annualRateBps: 2000 }],
      minimum: { type: "PERCENT_OF_BALANCE", bps: 500, floorCents: 10_00 },
      priority: 1,
      includeInPayoff: true,
    };
    const r = runPayoff(base({ debts: [card], surplusExDebtCents: 300_00 }));
    expect(r.months[0].debts.card.interestCents).toBe(83_33);
    expect(r.months[0].debts.card.scheduledCents).toBe(254_17);
    expect(r.months[0].debts.card.closingCents).toBe(4_829_16);
    expect(r.outcome.kind).toBe("paid");
  });

  it("avalanche pays the card before the LOC and costs less interest than LOC-first", () => {
    const card: DebtInput = {
      id: "card",
      name: "Card",
      kind: "CREDIT_CARD",
      balanceCents: 5_000_00,
      rates: [{ month: "2000-01", annualRateBps: 2000 }],
      minimum: { type: "PERCENT_OF_BALANCE", bps: 500, floorCents: 10_00 },
      priority: 1,
      includeInPayoff: true,
    };
    const input = base({
      debts: [loc(), card],
      surplusExDebtCents: 3_000_00,
      extras: [{ cents: 2_000_00 }],
      horizonMonths: 480,
    });
    const av = runPayoff({ ...input, strategy: "AVALANCHE" });
    const lf = runPayoff({ ...input, strategy: "LOC_FIRST" });
    expect(av.months[0].debts.card.extraCents).toBe(2_000_00);
    expect(lf.months[0].debts.loc.extraCents).toBe(2_000_00);
    expect(av.consumerInterestCents).toBeLessThan(lf.consumerInterestCents);
    expect(av.outcome.kind).toBe("paid");
    expect(lf.outcome.kind).toBe("paid");
  });

  it("roll-down: an ending lease payment rolls into the LOC; off → unallocated", () => {
    // LOC 10 000 $ at 0 %, lease 700 $/month ending Dec 2026, budget exactly balanced.
    const lease: DebtInput = {
      id: "lease",
      name: "Audi lease",
      kind: "LEASE",
      balanceCents: 0,
      rates: [],
      minimum: { type: "FIXED", cents: 700_00 },
      priority: 50,
      endMonth: "2026-12",
      includeInPayoff: false,
    };
    const l = loc({ balanceCents: 10_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } });
    const on = runPayoff(base({ debts: [l, lease], surplusExDebtCents: 700_00, rollDown: true }));
    expect(on.months[3].month).toBe("2026-12");
    expect(on.months[3].debts.lease.scheduledCents).toBe(700_00);
    expect(on.months[4].debts.lease.scheduledCents).toBe(0);
    expect(on.months[4].freedCents).toBe(700_00);
    expect(on.months[4].debts.loc.extraCents).toBe(700_00);
    expect(on.months[4].netBudgetCents).toBe(0);
    const off = runPayoff(base({ debts: [l, lease], surplusExDebtCents: 700_00, rollDown: false }));
    expect(off.months[4].debts.loc.extraCents).toBe(0);
    expect(off.months[4].netBudgetCents).toBe(700_00);
    expect(off.outcome.kind).toBe("never");
  });

  it("debt-paydown income (child care) goes to the highest-priority debt every month", () => {
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 6_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } })],
        debtPaydownIncomeCents: 500_00,
      }),
    );
    expect(r.months[0].debts.loc.extraCents).toBe(500_00);
    expect(r.outcome).toEqual({ kind: "paid", month: "2027-08", months: 12 });
  });

  it("scenario extra is new money: it reduces the debt in full and the unexplained part is flagged", () => {
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 10_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } })],
        surplusExDebtCents: 100_00,
        extras: [{ cents: 300_00 }],
      }),
    );
    expect(r.fundingGapCents).toBe(200_00);
    expect(r.months[0].netBudgetCents).toBe(100_00);
    expect(r.months[0].debts.loc.closingCents).toBe(9_700_00);
  });

  it("deficit budget + extra: the shortfall still grows the LOC while the extra pays it down", () => {
    const r = runPayoff(
      base({
        debts: [loc({ balanceCents: 10_000_00, rates: [], minimum: { type: "FIXED", cents: 0 } })],
        surplusExDebtCents: -400_00,
        extras: [{ cents: 1_000_00 }],
      }),
    );
    expect(r.months[0].debts.loc.deficitCents).toBe(400_00);
    expect(r.months[0].debts.loc.extraCents).toBe(1_000_00);
    expect(r.months[0].debts.loc.closingCents).toBe(9_400_00);
    expect(r.deficitFinanced).toBe(true);
    expect(r.fundingGapCents).toBe(1_000_00);
  });
});
