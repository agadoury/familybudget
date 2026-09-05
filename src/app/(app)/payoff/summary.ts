import type { Projection } from "@/lib/projection";
import type { ScenarioOverrides } from "@/lib/payoff";

/** Plain-language summary of a projection, e.g. "At 1 800 $/month extra plus the April and November stock-plan withdrawals, ..." */
export function summarize(
  p: Projection,
  overrides: ScenarioOverrides,
  fmt: { money: (c: number, o?: { compact?: boolean }) => string; month: (m: string) => string; lang: "en" | "fr" },
  lumpNames: string[],
): string {
  const { money, month, lang } = fmt;
  const extra = overrides.extraMonthly?.cents ?? 0;
  const parts: string[] = [];
  if (extra > 0) parts.push(lang === "fr" ? `${money(extra, { compact: true })}/mois de plus` : `${money(extra, { compact: true })}/month extra`);
  if (lumpNames.length) parts.push(lang === "fr" ? `les ${lumpNames.join(", ")}` : `the ${lumpNames.join(", ")}`);
  const lead = parts.length ? (lang === "fr" ? `Avec ${parts.join(" plus ")}, ` : `At ${parts.join(" plus ")}, `) : lang === "fr" ? "Au rythme actuel, " : "At the current pace, ";
  if (p.payoff.outcome.kind === "paid") {
    const n = p.payoff.outcome.months;
    return lang === "fr"
      ? `${lead}la dette à la consommation est éliminée en ${n} mois (${month(p.payoff.outcome.month)}). Intérêts totaux : ${money(p.payoff.consumerInterestCents, { compact: true })}.`
      : `${lead}the consumer debt is gone in ${n} months (${month(p.payoff.outcome.month)}). Total interest: ${money(p.payoff.consumerInterestCents, { compact: true })}.`;
  }
  const g = p.payoff.outcome.growthPerYearCents;
  return lang === "fr"
    ? `${lead}la dette n'est jamais remboursée : elle ${g >= 0 ? "augmente" : "diminue"} d'environ ${money(Math.abs(g), { compact: true })} par année.`
    : `${lead}the debt is never paid off: it ${g >= 0 ? "grows" : "shrinks"} by about ${money(Math.abs(g), { compact: true })} per year.`;
}
