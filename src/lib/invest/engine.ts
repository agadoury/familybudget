import { addMonths, parseMonthKey, type MonthKey } from "@/lib/frequency";
import { grantsForContribution, type GrantTracker } from "./grants";
import type { InvestInput, InvestMonth, InvestResult } from "./types";

/** Effective annual → monthly: (1 + r)^(1/12) − 1, so "6 %" grows exactly 6 % per year. */
export function monthlyRate(annualBps: number): number {
  return Math.pow(1 + annualBps / 10_000, 1 / 12) - 1;
}

function inRange(m: MonthKey, start?: MonthKey | null, end?: MonthKey | null): boolean {
  if (start && m < start) return false;
  if (end && m > end) return false;
  return true;
}

/**
 * Monthly compounding with end-of-month contributions:
 *   B(t+1) = B(t) × (1 + r_m) + C(t) + grants(t)
 * Balances are kept as floats internally and rounded to cents on output.
 */
export function runInvest(input: InvestInput): InvestResult {
  const bal: Record<string, number> = {};
  for (const a of input.accounts) bal[a.id] = a.balanceCents;

  const months: InvestMonth[] = [];
  const grantsByYear = new Map<number, { cesgCents: number; qesiCents: number }>();
  let totalContrib = 0;
  let totalGrants = 0;

  const startYear = parseMonthKey(input.startMonth).year;
  const tracker: GrantTracker = {
    year: startYear,
    cesgYear: input.resp.cesgThisYearCents,
    qesiYear: input.resp.qesiThisYearCents,
    cesgLife: input.resp.cesgReceivedCents,
    qesiLife: input.resp.qesiReceivedCents,
  };

  for (let i = 0; i < input.months; i++) {
    const m = addMonths(input.startMonth, i);
    const { year } = parseMonthKey(m);
    let contribMonth = 0;
    let grantMonth = 0;

    for (const a of input.accounts) {
      const rateBps = a.kind === "CASH" ? 0 : (input.globalReturnBps ?? a.returnBps);
      const rm = monthlyRate(rateBps);
      let c = 0;
      const paused = input.pauses.some(
        (p) => (!p.accountId || p.accountId === a.id) && inRange(m, p.startMonth, p.endMonth),
      );
      if (!paused) {
        for (const k of a.contributions) {
          if (!inRange(m, k.startMonth, k.endMonth)) continue;
          const redirected = input.redirects.some(
            (r) => r.contributionId === k.id && inRange(m, r.startMonth, r.endMonth),
          );
          if (redirected) continue;
          c += k.monthlyCents;
        }
      }
      let g = 0;
      if (a.kind === "RESP" && input.resp.enabled && c > 0) {
        const { cesg, qesi } = grantsForContribution(tracker, year, c);
        g = cesg + qesi;
        const y = grantsByYear.get(year) ?? { cesgCents: 0, qesiCents: 0 };
        y.cesgCents += cesg;
        y.qesiCents += qesi;
        grantsByYear.set(year, y);
      }
      bal[a.id] = bal[a.id] * (1 + rm) + c + g;
      contribMonth += c;
      grantMonth += g;
    }

    totalContrib += contribMonth;
    totalGrants += grantMonth;
    const rounded: Record<string, number> = {};
    let total = 0;
    let included = 0;
    for (const a of input.accounts) {
      const r = Math.round(bal[a.id]);
      rounded[a.id] = r;
      total += r;
      if (a.includeInNetWorth) included += r;
    }
    months.push({
      month: m,
      balances: rounded,
      contributionsCents: contribMonth,
      grantsCents: grantMonth,
      totalCents: total,
      includedCents: included,
    });
  }

  return {
    months,
    grantsByYear: [...grantsByYear.entries()]
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => a.year - b.year),
    totalContributionsCents: totalContrib,
    totalGrantsCents: totalGrants,
    endBalances: months.length ? months[months.length - 1].balances : Object.fromEntries(input.accounts.map((a) => [a.id, a.balanceCents])),
  };
}

/** Roll sub-account balances up to their parent (or themselves). */
export function rollUp(
  accounts: { id: string; parentId?: string | null }[],
  balances: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of accounts) {
    const key = a.parentId ?? a.id;
    out[key] = (out[key] ?? 0) + (balances[a.id] ?? 0);
  }
  return out;
}
