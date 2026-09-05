/**
 * Rule-based insights: short, specific, numeric sentences. No generic advice.
 * Everything is computed from the baseline projection and the data; nothing is stored.
 */
import { monthKey, monthDiff, toMonthlyCents, addMonths, parseMonthKey } from "@/lib/frequency";
import { payoffWithExtra, monthsSooner } from "@/lib/payoff";
import type { Projection } from "@/lib/projection";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";

export type Level = "good" | "watch" | "act";
export interface Insight {
  level: Level;
  text: string;
  key: string;
}

interface Fmt {
  money: (c: number, o?: { compact?: boolean; sign?: boolean }) => string;
  pct: (bps: number, digits?: number) => string;
  month: (m: string) => string;
  lang: "en" | "fr";
  personName: (p: "ALEX" | "SELIA" | "JOINT" | "SHARED" | null | undefined) => string;
}

export function generateInsights(data: HouseholdDTO, p: Projection, snapshots: SnapshotDTO[], f: Fmt, now = new Date()): Insight[] {
  const out: Insight[] = [];
  const { money, pct, month: fm, lang } = f;
  const fr = lang === "fr";
  const loc = data.debts.find((d) => d.type === "LOC");
  const locRate = loc ? (p.payoff.months[0]?.debts[loc.id]?.rateBps ?? 0) : 0;
  const fcf = p.payoff.freeCashFlowCents;
  const lumpPerYear = data.lumpSumSchedules.filter((l) => l.active).reduce((s, l) => s + l.amountCents * l.months.length, 0) + p.budget.debtPaydownIncomeCents * 12;

  // 1. Deficit
  if (fcf < 0) {
    const yearly = -fcf * 12;
    out.push({
      key: "deficit",
      level: "act",
      text: fr
        ? `Il manque ${money(-fcf)}/mois avant les montants forfaitaires ; la marge augmente de ${money(yearly, { compact: true })}/an sauf si les retraits et l'allocation (${money(lumpPerYear, { compact: true })}/an) le couvrent${lumpPerYear >= yearly ? " — ils le couvrent" : " — ils ne suffisent pas"}.`
        : `You are short ${money(-fcf)}/month before lump sums; the LOC grows by ${money(yearly, { compact: true })}/year unless the withdrawals and child-care payment (${money(lumpPerYear, { compact: true })}/year) cover it${lumpPerYear >= yearly ? " — they do" : " — they do not"}.`,
    });
  }

  // 2. Positive FCF not applied
  if (fcf > 0 && p.consumerDebtCents > 0) {
    const target = [...data.debts].filter((d) => d.includeInPayoff && d.balanceCents > 0).sort((a, b) => (p.payoff.months[0]?.debts[b.id]?.rateBps ?? 0) - (p.payoff.months[0]?.debts[a.id]?.rateBps ?? 0))[0];
    const withExtra = payoffWithExtra(p.payoffInput, fcf);
    const saved = p.payoff.consumerInterestCents - withExtra.consumerInterestCents;
    const sooner = monthsSooner(p.payoff, withExtra);
    if (target && saved > 0)
      out.push({
        key: "unallocated",
        level: "watch",
        text: fr
          ? `${money(fcf)}/mois n'est pas alloué ; sur ${target.name}, cela économise ${money(saved, { compact: true })} d'intérêts${sooner ? ` et ${sooner} mois` : ""}.`
          : `You have ${money(fcf)}/month unallocated; putting it on ${target.name} saves ${money(saved, { compact: true })} in interest${sooner ? ` and ${sooner} months` : ""}.`,
      });
  }

  // 3. Minimum ≤ interest
  for (const d of data.debts.filter((d) => d.includeInPayoff && d.balanceCents > 0)) {
    const m0 = p.payoff.months[0]?.debts[d.id];
    if (m0 && m0.scheduledCents <= m0.interestCents && m0.interestCents > 0)
      out.push({
        key: `min-${d.id}`,
        level: "watch",
        text: fr
          ? `Le minimum de ${d.name} (${money(m0.scheduledCents)}) couvre seulement les intérêts (${money(m0.interestCents)}) ; le capital ne bouge pas au minimum.`
          : `${d.name}'s minimum (${money(m0.scheduledCents)}) only covers interest (${money(m0.interestCents)}); principal does not move at the minimum.`,
      });
  }

  // 4. Debts above the LOC rate
  if (loc) {
    for (const d of data.debts.filter((d) => d.includeInPayoff && d.id !== loc.id && d.balanceCents > 0)) {
      const r = p.payoff.months[0]?.debts[d.id]?.rateBps ?? 0;
      if (r > locRate) {
        const diff = Math.round((d.balanceCents * (r - locRate)) / 10_000 / 12);
        out.push({
          key: `rate-${d.id}`,
          level: "watch",
          text: fr
            ? `${d.name} à ${pct(r)} coûte ${money(diff)}/mois de plus que le même solde sur la marge (${pct(locRate)}).`
            : `${d.name} at ${pct(r)} costs ${money(diff)}/month more than the same balance on the LOC (${pct(locRate)}).`,
        });
      }
    }
  }

  // 5. Flexible category above its 3-month average by > 15 %
  const withSpend = snapshots.filter((s) => s.spend.length > 0);
  if (withSpend.length >= 2) {
    const latest = withSpend[withSpend.length - 1];
    const prev = withSpend.slice(-4, -1);
    for (const sp of latest.spend) {
      const hist = prev.map((s) => s.spend.find((x) => x.category === sp.category)?.amountCents).filter((x): x is number => x !== undefined);
      if (hist.length === 0) continue;
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      if (avg > 0 && sp.amountCents > avg * 1.15)
        out.push({
          key: `cat-${sp.category}`,
          level: "watch",
          text: fr
            ? `${sp.category} : ${money(sp.amountCents)} en ${fm(latest.month)}, ${Math.round(((sp.amountCents - avg) / avg) * 100)} % au-dessus de la moyenne des ${hist.length} derniers mois (${money(avg)}).`
            : `${sp.category}: ${money(sp.amountCents)} in ${fm(latest.month)}, ${Math.round(((sp.amountCents - avg) / avg) * 100)} % above the last ${hist.length}-month average (${money(avg)}).`,
        });
    }
  }

  // 6. Savings line with assumed return below the LOC rate
  if (loc && loc.balanceCents > 0) {
    for (const c of data.contributions.filter((c) => c.source === "SPENDING_ACCOUNT")) {
      const a = data.accounts.find((x) => x.id === c.accountId);
      if (a && a.returnBps < locRate) {
        const monthly = toMonthlyCents(c.amountCents, c.frequency);
        out.push({
          key: `spread-${c.id}`,
          level: "watch",
          text: fr
            ? `${a.name} : ${money(monthly)}/mois à ${pct(a.returnBps, 1)} présumé contre ${pct(locRate)} sur la marge — écart de ${pct(locRate - a.returnBps, 2)}.`
            : `${a.name}: ${money(monthly)}/month at an assumed ${pct(a.returnBps, 1)} vs ${pct(locRate)} on the LOC — a ${pct(locRate - a.returnBps, 2)} spread.`,
        });
      }
    }
  }

  // 7. Sinking fund underfunded for an annual bill due within 60 days (due = anniversary of the start date)
  const nowKey = monthKey(now);
  for (const e of data.expenses.filter((e) => e.frequency === "ANNUAL")) {
    const { month: dueMonth } = parseMonthKey(e.startDate.slice(0, 7));
    const y = parseMonthKey(nowKey).year;
    let due = `${y}-${String(dueMonth).padStart(2, "0")}`;
    if (due < nowKey) due = `${y + 1}-${String(dueMonth).padStart(2, "0")}`;
    const monthsUntil = monthDiff(nowKey, due);
    if (monthsUntil <= 2) {
      const monthly = toMonthlyCents(e.amountCents, e.frequency);
      const accumulated = monthly * Math.min(12, Math.max(0, 12 - monthsUntil));
      const startedMonthsAgo = monthDiff(e.startDate.slice(0, 7), nowKey);
      const funded = Math.min(accumulated, monthly * Math.max(0, startedMonthsAgo));
      if (funded < e.amountCents)
        out.push({
          key: `sink-${e.id}`,
          level: "watch",
          text: fr
            ? `${e.name} (${money(e.amountCents)}) arrive vers ${fm(due)} ; le fonds de réserve a accumulé environ ${money(funded)} — manque ${money(e.amountCents - funded)}.`
            : `${e.name} (${money(e.amountCents)}) is due around ${fm(due)}; the sinking fund holds about ${money(funded)} — ${money(e.amountCents - funded)} short.`,
        });
    }
  }

  // 8. Payoff slipped vs. last check-in; stale investment balances
  const last = snapshots[snapshots.length - 1];
  if (last?.projectedPayoffMonth && p.payoff.outcome.kind === "paid") {
    const drift = monthDiff(last.projectedPayoffMonth, p.payoff.outcome.month);
    if (drift > 0)
      out.push({ key: "slip", level: "act", text: fr ? `La date sans dette a glissé de ${drift} mois depuis le bilan de ${fm(last.month)} (${fm(last.projectedPayoffMonth)} → ${fm(p.payoff.outcome.month)}).` : `The debt-free date slipped ${drift} months since the ${fm(last.month)} check-in (${fm(last.projectedPayoffMonth)} → ${fm(p.payoff.outcome.month)}).` });
    else if (drift < 0)
      out.push({ key: "gain", level: "good", text: fr ? `La date sans dette a avancé de ${-drift} mois depuis le bilan de ${fm(last.month)}.` : `The debt-free date moved ${-drift} months earlier since the ${fm(last.month)} check-in.` });
  }
  const stale = data.accounts.filter((a) => !data.accounts.some((c) => c.parentId === a.id) && (now.getTime() - new Date(a.balanceAsOf).getTime()) / 86_400_000 > 90);
  if (stale.length)
    out.push({ key: "stale", level: "watch", text: fr ? `${stale.length} solde(s) de placement non mis à jour depuis 90+ jours : ${stale.map((a) => a.name).join(", ")}.` : `${stale.length} investment balance(s) not updated in 90+ days: ${stale.map((a) => a.name).join(", ")}.` });

  // 9. Next lump sum (informational)
  const nextLump = p.payoffInput.lumpSums.filter((l) => l.kind === "scheduled" && l.month >= nowKey).sort((a, b) => a.month.localeCompare(b.month))[0];
  if (nextLump && out.length < 3)
    out.push({ key: "nextlump", level: "good", text: fr ? `Prochain ${nextLump.label.toLowerCase()} : ${money(nextLump.cents, { compact: true })} en ${fm(nextLump.month)}, appliqué à la dette prioritaire.` : `Next ${nextLump.label.toLowerCase()}: ${money(nextLump.cents, { compact: true })} in ${fm(nextLump.month)}, applied to the highest-priority debt.` });

  void addMonths;
  const order: Record<Level, number> = { act: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
