import { addMonths, monthDiff, type MonthKey } from "@/lib/frequency";
import { roundCents } from "@/lib/money";
import type {
  DebtInput,
  DebtMonth,
  PayoffInput,
  PayoffMonth,
  PayoffResult,
  Strategy,
} from "./types";

const DEFAULT_HORIZON = 480; // 40 years

/** Rate in force for a month: latest point with month <= m; before the first point, the first point. */
export function rateForMonth(debt: Pick<DebtInput, "rates">, m: MonthKey): number {
  const pts = debt.rates;
  if (pts.length === 0) return 0;
  let bps = pts[0].annualRateBps;
  for (const p of pts) {
    if (p.month <= m) bps = p.annualRateBps;
    else break;
  }
  return bps;
}

/** Monthly interest in cents on a balance at an annual rate in bps (simple r/12, posted monthly). */
export function monthlyInterest(balanceCents: number, annualRateBps: number): number {
  return roundCents((balanceCents * annualRateBps) / 10_000 / 12);
}

/** Scheduled (minimum) payment for a debt given the balance after interest. */
export function scheduledPayment(
  debt: DebtInput,
  balanceAfterInterest: number,
  interest: number,
  m: MonthKey,
): number {
  if (balanceAfterInterest <= 0 && debt.kind !== "LEASE") return 0;
  if (debt.endMonth && m > debt.endMonth) return 0;
  let p: number;
  switch (debt.minimum.type) {
    case "FIXED":
      p = debt.minimum.cents;
      break;
    case "PERCENT_OF_BALANCE":
      p = Math.max(debt.minimum.floorCents, roundCents((balanceAfterInterest * debt.minimum.bps) / 10_000));
      break;
    case "INTEREST_ONLY":
      p = interest;
      break;
  }
  // A lease has no balance: its payment is a pure cash outflow until it ends.
  if (debt.kind === "LEASE") return p;
  return Math.min(p, balanceAfterInterest);
}

function sortForStrategy(
  debts: DebtInput[],
  balances: Record<string, number>,
  m: MonthKey,
  strategy: Strategy,
): DebtInput[] {
  const candidates = debts.filter((d) => d.includeInPayoff && balances[d.id] > 0);
  const byPriority = (a: DebtInput, b: DebtInput) => a.priority - b.priority;
  switch (strategy) {
    case "AVALANCHE":
      return candidates.sort(
        (a, b) => rateForMonth(b, m) - rateForMonth(a, m) || byPriority(a, b) || balances[a.id] - balances[b.id],
      );
    case "SNOWBALL":
      return candidates.sort((a, b) => balances[a.id] - balances[b.id] || byPriority(a, b));
    case "LOC_FIRST":
      return candidates.sort(
        (a, b) =>
          Number(b.kind === "LOC") - Number(a.kind === "LOC") ||
          rateForMonth(b, m) - rateForMonth(a, m) ||
          byPriority(a, b),
      );
  }
}

/**
 * Month-by-month amortization of a set of debts.
 *
 * Per month, in order: interest posts on opening balances → scheduled payments →
 * budget shortfall (if any) is added to the LOC → the extra pool (scenario extra +
 * debt-paydown income + rolled-down freed payments + lump sums) is applied in
 * strategy order → record.
 */
export function runPayoff(input: PayoffInput): PayoffResult {
  const horizon = input.horizonMonths ?? DEFAULT_HORIZON;
  const debts = input.debts;
  const balances: Record<string, number> = {};
  for (const d of debts) balances[d.id] = Math.max(0, d.balanceCents);

  const months: PayoffMonth[] = [];
  const interestByDebt: Record<string, number> = Object.fromEntries(debts.map((d) => [d.id, 0]));
  const payoffMonthByDebt: Record<string, MonthKey | null> = Object.fromEntries(debts.map((d) => [d.id, null]));
  const endedAnnounced = new Set<string>();
  const locDebt = debts.find((d) => d.absorbsDeficit) ?? debts.find((d) => d.kind === "LOC") ?? null;

  let cumulativeInterest = 0;
  let scheduledMonth0 = 0;
  let deficitFinanced = false;
  let fundingGap = 0;
  let paidOffMonth: MonthKey | null = null;

  const extraFor = (m: MonthKey) =>
    input.extras.reduce((sum, e) => {
      if (e.startMonth && m < e.startMonth) return sum;
      if (e.endMonth && m > e.endMonth) return sum;
      return sum + e.cents;
    }, 0);

  const consumerTotal = () => debts.filter((d) => d.includeInPayoff).reduce((s, d) => s + balances[d.id], 0);
  const anyConsumerDebt = debts.some((d) => d.includeInPayoff && d.balanceCents > 0);

  for (let i = 0; i < horizon; i++) {
    const m = addMonths(input.startMonth, i);
    const events: string[] = [];
    const dm: Record<string, DebtMonth> = {};

    // 1. interest + scheduled payments
    let scheduledTotal = 0;
    let interestTotal = 0;
    for (const d of debts) {
      const opening = balances[d.id];
      const rateBps = rateForMonth(d, m);
      const interest = d.kind === "LEASE" ? 0 : monthlyInterest(opening, rateBps);
      const afterInterest = opening + interest;
      const sched = scheduledPayment(d, afterInterest, interest, m);
      balances[d.id] = d.kind === "LEASE" ? 0 : afterInterest - sched;
      scheduledTotal += sched;
      interestTotal += interest;
      interestByDebt[d.id] += interest;
      dm[d.id] = {
        openingCents: opening,
        interestCents: interest,
        scheduledCents: sched,
        extraCents: 0,
        deficitCents: 0,
        closingCents: balances[d.id],
        rateBps,
      };
      if (d.endMonth && m === d.endMonth && !endedAnnounced.has(d.id)) {
        endedAnnounced.add(d.id);
        events.push(`${d.name}: last scheduled payment`);
      }
    }
    if (i === 0) scheduledMonth0 = scheduledTotal;

    // 2. budget: what the spending account has left this month
    const extra = extraFor(m);
    const freed = Math.max(0, scheduledMonth0 - scheduledTotal);
    const rolled = input.rollDown ? freed : 0;
    // Scenario extras are *new money* directed at debt (from cuts, a raise, redirected savings);
    // they never come out of the budget itself, so a deficit stays visible instead of being
    // silently netted against them. fundingGap tells the UI how much of the extra exceeds
    // what the budget actually frees up.
    const netBudget = input.surplusExDebtCents - scheduledTotal - rolled;
    if (i === 0) {
      const fcf0 = input.surplusExDebtCents - scheduledTotal;
      fundingGap = Math.max(0, extra - Math.max(0, fcf0));
    }
    if (netBudget < 0) {
      deficitFinanced = true;
      if (locDebt) {
        balances[locDebt.id] += -netBudget;
        dm[locDebt.id].deficitCents = -netBudget;
        dm[locDebt.id].closingCents = balances[locDebt.id];
      }
    }

    // 3. extra pool
    const lumps = input.lumpSums.filter((l) => l.month === m);
    const lumpTotal = lumps.reduce((s, l) => s + l.cents, 0);
    for (const l of lumps) events.push(`${l.label}: ${l.cents / 100} $`);
    let pool = extra + input.debtPaydownIncomeCents + rolled + lumpTotal;
    const poolTotal = pool;
    for (const d of sortForStrategy(debts, balances, m, input.strategy)) {
      if (pool <= 0) break;
      const pay = Math.min(pool, balances[d.id]);
      balances[d.id] -= pay;
      pool -= pay;
      dm[d.id].extraCents += pay;
      dm[d.id].closingCents = balances[d.id];
    }
    const leftover = pool;

    // 4. payoff events
    for (const d of debts) {
      if (d.kind === "LEASE") continue;
      if (balances[d.id] <= 0 && dm[d.id].openingCents > 0 && payoffMonthByDebt[d.id] === null) {
        payoffMonthByDebt[d.id] = m;
        events.push(`${d.name} paid off`);
      }
      if (balances[d.id] > 0 && payoffMonthByDebt[d.id] !== null) {
        // re-borrowed (deficit after payoff)
        payoffMonthByDebt[d.id] = null;
      }
    }

    cumulativeInterest += interestTotal;
    const consumer = consumerTotal();
    const principal = Object.values(dm).reduce(
      (s, x) => s + (x.openingCents + x.interestCents + x.deficitCents - x.closingCents),
      0,
    );
    months.push({
      month: m,
      index: i,
      debts: dm,
      consumerBalanceCents: consumer,
      totalBalanceCents: debts.reduce((s, d) => s + balances[d.id], 0),
      interestCents: interestTotal,
      principalCents: principal,
      cumulativeInterestCents: cumulativeInterest,
      scheduledCents: scheduledTotal,
      extraPoolCents: poolTotal,
      lumpSumCents: lumpTotal,
      freedCents: freed,
      netBudgetCents: netBudget,
      leftoverCents: leftover,
      events,
    });

    if (anyConsumerDebt && consumer <= 0 && paidOffMonth === null) {
      paidOffMonth = m;
      break;
    }
    if (!anyConsumerDebt && i >= 11) break;
  }

  const consumerInterest = debts
    .filter((d) => d.includeInPayoff)
    .reduce((s, d) => s + interestByDebt[d.id], 0);

  let outcome: PayoffResult["outcome"];
  if (paidOffMonth) {
    outcome = { kind: "paid", month: paidOffMonth, months: monthDiff(input.startMonth, paidOffMonth) + 1 };
  } else {
    const first = months[0]?.consumerBalanceCents ?? 0;
    const last = months[months.length - 1]?.consumerBalanceCents ?? 0;
    const years = Math.max(1, months.length) / 12;
    outcome = {
      kind: "never",
      growthPerYearCents: roundCents((last - first) / years),
      horizonMonths: months.length,
    };
  }

  return {
    months,
    outcome,
    totalInterestCents: cumulativeInterest,
    consumerInterestCents: consumerInterest,
    interestByDebtCents: interestByDebt,
    payoffMonthByDebt,
    freeCashFlowCents: input.surplusExDebtCents - scheduledMonth0,
    scheduledMonth0Cents: scheduledMonth0,
    fundingGapCents: fundingGap,
    deficitFinanced,
    startMonth: input.startMonth,
  };
}

/** "We can afford X/month → payoff on <date>" is just runPayoff with an extra. */
export function payoffWithExtra(input: PayoffInput, extraCents: number): PayoffResult {
  return runPayoff({ ...input, extras: [...input.extras, { cents: extraCents }] });
}

/**
 * Reverse solver: smallest additional monthly payment (on top of the input's extras)
 * that makes every consumer debt reach zero by `targetMonth` (inclusive).
 * Payoff month is monotone in the extra, so bisection to the cent is exact.
 * Returns null when even `maxExtraCents` cannot reach the date.
 */
export function solveExtraForTarget(
  input: PayoffInput,
  targetMonth: MonthKey,
  maxExtraCents = 50_000_00,
): { extraCents: number; result: PayoffResult } | null {
  const horizon = monthDiff(input.startMonth, targetMonth) + 2;
  const base = { ...input, horizonMonths: Math.max(1, horizon) };
  const reaches = (x: number) => {
    const r = payoffWithExtra(base, x);
    return r.outcome.kind === "paid" && r.outcome.month <= targetMonth ? r : null;
  };
  const zero = reaches(0);
  if (zero) return { extraCents: 0, result: zero };
  let hi = maxExtraCents;
  let hiResult = reaches(hi);
  if (!hiResult) return null;
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const r = reaches(mid);
    if (r) {
      hi = mid;
      hiResult = r;
    } else lo = mid;
  }
  return { extraCents: hi, result: hiResult };
}

/** Months between two payoff outcomes (positive = `b` is sooner). */
export function monthsSooner(a: PayoffResult, b: PayoffResult): number | null {
  if (a.outcome.kind !== "paid" || b.outcome.kind !== "paid") return null;
  return a.outcome.months - b.outcome.months;
}
