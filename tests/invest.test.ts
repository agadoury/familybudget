import { describe, expect, it } from "vitest";
import { monthlyRate, runInvest, rollUp, type InvestAccountInput, type InvestInput } from "@/lib/invest";

const START = "2026-09";

function acct(over: Partial<InvestAccountInput> = {}): InvestAccountInput {
  return {
    id: "a",
    name: "TFSA",
    owner: "ALEX",
    kind: "TFSA",
    balanceCents: 0,
    returnBps: 600,
    includeInNetWorth: true,
    contributions: [],
    ...over,
  };
}

function base(over: Partial<InvestInput> = {}): InvestInput {
  return {
    startMonth: START,
    months: 12,
    accounts: [acct()],
    pauses: [],
    redirects: [],
    resp: { enabled: false, cesgReceivedCents: 0, qesiReceivedCents: 0, cesgThisYearCents: 0, qesiThisYearCents: 0 },
    ...over,
  };
}

describe("investment engine", () => {
  it("effective annual return compounds to exactly the annual rate after 12 months", () => {
    // 10 000 $ at 6 % → 10 600,00 $ after one year (monthly rate = 1.06^(1/12) − 1 ≈ 0.4868 %).
    expect(monthlyRate(600)).toBeCloseTo(0.0048675506, 9);
    const r = runInvest(base({ accounts: [acct({ balanceCents: 10_000_00 })] }));
    expect(r.months[11].balances.a).toBe(10_600_00);
  });

  it("monthly contributions at 0 % simply add up; at 6 % they match the annuity formula", () => {
    const zero = runInvest(
      base({ accounts: [acct({ returnBps: 0, contributions: [{ id: "c", monthlyCents: 100_00 }] })] }),
    );
    expect(zero.months[11].balances.a).toBe(1_200_00);
    expect(zero.totalContributionsCents).toBe(1_200_00);
    // FV of 100 $/month for 12 months at r_m: 100 × ((1+r_m)^12 − 1)/r_m = 100 × 0.06 / 0.0048675506 = 1 232,65 $
    const six = runInvest(base({ accounts: [acct({ contributions: [{ id: "c", monthlyCents: 100_00 }] })] }));
    expect(Math.abs(six.months[11].balances.a - 1_232_65)).toBeLessThanOrEqual(1);
  });

  it("contribution pause skips the paused months", () => {
    // 100 $/month, paused Dec 2026 – Feb 2027 (3 months) → 900 $ after 12 months at 0 %.
    const r = runInvest(
      base({
        accounts: [acct({ returnBps: 0, contributions: [{ id: "c", monthlyCents: 100_00 }] })],
        pauses: [{ startMonth: "2026-12", endMonth: "2027-02" }],
      }),
    );
    expect(r.months[3].contributionsCents).toBe(0);
    expect(r.months[11].balances.a).toBe(900_00);
  });

  it("redirecting one contribution removes only that line for the window", () => {
    const r = runInvest(
      base({
        accounts: [
          acct({
            returnBps: 0,
            contributions: [
              { id: "payroll", monthlyCents: 200_00 },
              { id: "topup", monthlyCents: 100_00 },
            ],
          }),
        ],
        redirects: [{ contributionId: "topup", startMonth: "2026-09", endMonth: "2027-02" }],
      }),
    );
    // 12 × 200 + 6 × 100 = 3 000
    expect(r.months[11].balances.a).toBe(3_000_00);
  });

  it("RESP grants: 20 % CESG (500 $/yr cap) and 10 % QESI (250 $/yr cap), lifetime caps respected", () => {
    // 300 $/month at 0 %. 2026 (Sep–Dec): 1 200 $ → CESG 240, QESI 120.
    // 2027: 3 600 $ → CESG capped at 500 (20 % would be 720), QESI capped at 250.
    // Balance end of Dec 2027 = 4 800 + 360 + 750 = 5 910 $.
    const r = runInvest(
      base({
        months: 16,
        accounts: [acct({ kind: "RESP", returnBps: 0, contributions: [{ id: "c", monthlyCents: 300_00 }] })],
        resp: { enabled: true, cesgReceivedCents: 0, qesiReceivedCents: 0, cesgThisYearCents: 0, qesiThisYearCents: 0 },
      }),
    );
    expect(r.grantsByYear).toEqual([
      { year: 2026, cesgCents: 240_00, qesiCents: 120_00 },
      { year: 2027, cesgCents: 500_00, qesiCents: 250_00 },
    ]);
    expect(r.months[15].month).toBe("2027-12");
    expect(r.months[15].balances.a).toBe(5_910_00);

    // Lifetime cap: only 360 $ of CESG room left → 2026 gets 240, 2027 gets 120.
    const capped = runInvest(
      base({
        months: 16,
        accounts: [acct({ kind: "RESP", returnBps: 0, contributions: [{ id: "c", monthlyCents: 300_00 }] })],
        resp: {
          enabled: true,
          cesgReceivedCents: 7_200_00 - 360_00,
          qesiReceivedCents: 3_600_00,
          cesgThisYearCents: 0,
          qesiThisYearCents: 0,
        },
      }),
    );
    expect(capped.grantsByYear).toEqual([
      { year: 2026, cesgCents: 240_00, qesiCents: 0 },
      { year: 2027, cesgCents: 120_00, qesiCents: 0 },
    ]);
    // Grants off → none.
    const off = runInvest(
      base({ months: 16, accounts: [acct({ kind: "RESP", returnBps: 0, contributions: [{ id: "c", monthlyCents: 300_00 }] })] }),
    );
    expect(off.totalGrantsCents).toBe(0);
  });

  it("cash accounts earn 0 % even with a global return override; roll-up sums children", () => {
    const r = runInvest(
      base({
        globalReturnBps: 800,
        accounts: [
          acct({ id: "cash", kind: "CASH", balanceCents: 2_000_00 }),
          acct({ id: "p", kind: "RRSP", balanceCents: 0 }),
          acct({ id: "c1", kind: "RRSP", parentId: "p", balanceCents: 1_000_00, returnBps: 0 }),
          acct({ id: "c2", kind: "RRSP", parentId: "p", balanceCents: 1_000_00, returnBps: 0 }),
        ],
      }),
    );
    expect(r.months[11].balances.cash).toBe(2_000_00);
    expect(r.months[11].balances.c1).toBe(1_080_00);
    const rolled = rollUp(
      [{ id: "p" }, { id: "c1", parentId: "p" }, { id: "c2", parentId: "p" }],
      r.months[11].balances,
    );
    expect(rolled.p).toBe(2_160_00);
  });
});
