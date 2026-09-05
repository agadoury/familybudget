/**
 * Advisor: deterministic, quantified recommendations built from the household's own numbers.
 * Every figure comes from the payoff / investment engines run under an alternative plan, so
 * each recommendation can be tried as a scenario. No generic advice: if a rule has nothing
 * specific to say for this household, it says nothing.
 */
import { addMonths, monthDiff, monthKey, toMonthlyCents, type MonthKey } from "@/lib/frequency";
import { buildProjection, netOfTax, type HouseholdData, type Projection } from "@/lib/projection";
import { EMPTY_OVERRIDES, monthsSooner, payoffWithExtra, type PayoffResult, type ScenarioOverrides } from "@/lib/payoff";
import { monthlyRate, CESG_ANNUAL_CAP_CENTS, QESI_ANNUAL_CAP_CENTS, CESG_LIFETIME_CAP_CENTS, QESI_LIFETIME_CAP_CENTS } from "@/lib/invest";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";

export type Horizon = "now" | "next" | "later" | "housekeeping";
export type Category = "cashflow" | "debt" | "investing" | "family" | "housekeeping";

export interface Impact {
  label: string;
  value: string;
  tone?: "good" | "watch" | "act";
}

export interface Recommendation {
  id: string;
  horizon: Horizon;
  category: Category;
  title: string;
  why: string;
  steps: string[];
  impact: Impact[];
  caveats?: string[];
  tryName?: string;
  tryOverrides?: ScenarioOverrides;
}

export interface AdvisorReport {
  headline: string;
  summary: string[];
  recommendations: Recommendation[];
  assumptions: string[];
}

export interface Fmt {
  money: (c: number, o?: { compact?: boolean; sign?: boolean }) => string;
  pct: (bps: number, digits?: number) => string;
  month: (m: string) => string;
  lang: "en" | "fr";
  personName: (p: "ALEX" | "SELIA" | "JOINT" | "SHARED" | null | undefined) => string;
}

export interface RoomRow {
  person: "ALEX" | "SELIA";
  accountType: "TFSA" | "RRSP";
  roomCents: number;
}

const RESP_TARGET_YEAR_CENTS = 2_500_00; // contribution that captures the full annual CESG + QESI

export function advise(data: HouseholdDTO, snapshots: SnapshotDTO[], rooms: RoomRow[], f: Fmt, now = new Date(), defaultOverrides: ScenarioOverrides = EMPTY_OVERRIDES): AdvisorReport {
  const fr = f.lang === "fr";
  const T = (en: string, frs: string) => (fr ? frs : en);
  const { money, pct, month: fm, personName } = f;
  const startMonth = monthKey(now);
  const hd = data as unknown as HouseholdData;
  const run = (o: ScenarioOverrides, withBonuses = false) => buildProjection(hd, { startMonth, overrides: o, withBonuses, respGrants: true });
  const base = run(defaultOverrides);
  const recs: Recommendation[] = [];
  const rates = data.settings.marginalRateBps ?? { ALEX: 4000, SELIA: 4000 };

  const fcf = base.payoff.freeCashFlowCents;
  const b = base.budget;
  const loc = data.debts.find((d) => d.type === "LOC" && d.includeInPayoff);
  const locRate = loc ? base.payoff.months[0]?.debts[loc.id]?.rateBps ?? 0 : 0;
  const cards = data.debts.filter((d) => d.type === "CREDIT_CARD" && d.includeInPayoff && d.balanceCents > 0);
  const debtMin0 = base.payoff.scheduledMonth0Cents;
  const committedAll = b.fixedCents + b.savingsCents + debtMin0 + b.flexibleCents;
  const estimateLines = data.expenses.filter((e) => e.notes?.toLowerCase().startsWith("estimate"));
  const estimateMonthly = estimateLines.reduce((s, e) => s + toMonthlyCents(e.amountCents, e.frequency), 0);
  const P = (x: Projection | PayoffResult): PayoffResult => ("payoff" in x ? x.payoff : x);
  const delta = (x: Projection | PayoffResult) => { const alt = P(x); return { sooner: monthsSooner(base.payoff, alt), saved: base.payoff.consumerInterestCents - alt.consumerInterestCents }; };
  const impactOf = (x: Projection | PayoffResult): Impact[] => {
    const alt = P(x);
    const d = delta(alt);
    const out: Impact[] = [];
    if (alt.outcome.kind === "paid") out.push({ label: T("Debt-free", "Sans dette"), value: fm(alt.outcome.month), tone: "good" });
    if (d.sooner !== null && d.sooner !== 0) out.push({ label: T("vs. today's plan", "vs plan actuel"), value: `${d.sooner > 0 ? "▲" : "▼"} ${Math.abs(d.sooner)} ${T("months", "mois")} ${d.sooner > 0 ? T("sooner", "plus tôt") : T("later", "plus tard")}`, tone: d.sooner > 0 ? "good" : "act" });
    if (d.saved !== 0) out.push({ label: T("Interest", "Intérêts"), value: `${d.saved > 0 ? "−" : "+"}${money(Math.abs(d.saved), { compact: true })}`, tone: d.saved > 0 ? "good" : "act" });
    return out;
  };

  // ---------- 1. Confirm estimates before cutting ----------
  if (estimateLines.length > 0 && fcf < 0 && estimateMonthly >= -fcf * 0.5) {
    recs.push({
      id: "confirm-estimates",
      horizon: "now",
      category: "housekeeping",
      title: T("Before cutting anything, confirm the estimated lines", "Avant de couper quoi que ce soit, confirmez les lignes estimées"),
      why: T(
        `${estimateLines.length} budget lines are still estimates and add up to ${money(estimateMonthly)}/month — ${Math.round((estimateMonthly / -fcf) * 100)} % of the ${money(-fcf)} monthly shortfall. The sign of your cash flow depends on them.`,
        `${estimateLines.length} lignes du budget sont encore des estimations et totalisent ${money(estimateMonthly)}/mois — ${Math.round((estimateMonthly / -fcf) * 100)} % du manque mensuel de ${money(-fcf)}. Le signe de votre flux de trésorerie en dépend.`,
      ),
      steps: estimateLines.map((e) => T(`Replace “${e.name}” (${money(toMonthlyCents(e.amountCents, e.frequency))}/month) with the real bill, then remove the word “estimate” from its notes.`, `Remplacez « ${e.name} » (${money(toMonthlyCents(e.amountCents, e.frequency))}/mois) par la vraie facture, puis retirez le mot « estimate » des notes.`)),
      impact: [{ label: T("At stake", "En jeu"), value: `${money(estimateMonthly)}${T("/month", "/mois")}`, tone: "watch" }],
    });
  }

  // ---------- 2. Close the monthly gap ----------
  if (fcf < 0) {
    const gap = -fcf;
    const candidates = data.expenses
      .filter((e) => e.type === "FLEXIBLE" && !e.essential)
      .map((e) => ({ e, monthly: toMonthlyCents(e.amountCents, e.frequency) }))
      .sort((a, c) => c.monthly - a.monthly);
    const cuts: ScenarioOverrides["expenseCuts"] = [];
    const lines: string[] = [];
    let freed = 0;
    for (const { e, monthly } of candidates) {
      if (freed >= gap) break;
      const need = gap - freed;
      const cutPct = Math.min(50, Math.max(10, Math.ceil((need / monthly) * 100 / 5) * 5));
      const amount = Math.round((monthly * cutPct) / 100);
      cuts.push({ expenseId: e.id, pct: cutPct });
      lines.push(T(`${e.name}: −${cutPct} % (${money(amount)}/month, from ${money(monthly)} to ${money(monthly - amount)})`, `${e.name} : −${cutPct} % (${money(amount)}/mois, de ${money(monthly)} à ${money(monthly - amount)})`));
      freed += amount;
    }
    const vacation = data.expenses.find((e) => /vacation|vacances|voyage/i.test(`${e.name} ${e.category}`));
    const vacationMonthly = vacation ? toMonthlyCents(vacation.amountCents, vacation.frequency) : 0;
    const overrides: ScenarioOverrides = { ...EMPTY_OVERRIDES, expenseCuts: cuts, extraMonthly: freed > gap ? { cents: Math.round((freed - gap) / 5000) * 5000 } : null };
    const alt = run(overrides);
    const remaining = Math.max(0, gap - freed);
    recs.push({
      id: "close-gap",
      horizon: "now",
      category: "cashflow",
      title: T(`Close the ${money(gap, { compact: true })}/month gap`, `Combler l’écart de ${money(gap, { compact: true })}/mois`),
      why: T(
        `Every month the spending account comes up ${money(gap)} short and the line of credit fills it: ${money(gap * 12, { compact: true })} a year of new borrowing at ${pct(locRate)}, before the stock-plan withdrawals pay it back down. Cutting the largest non-essential flexible lines by at most half frees ${money(freed)}/month${remaining > 0 ? T(`, leaving ${money(remaining)} to find elsewhere`, `, il reste ${money(remaining)} à trouver ailleurs`) : ""}.`,
        `Chaque mois, il manque ${money(gap)} au compte courant et la marge de crédit comble la différence : ${money(gap * 12, { compact: true })} par année de nouvel emprunt à ${pct(locRate)}, avant que les retraits du régime d’actions ne le remboursent. Couper d’au plus la moitié les plus grosses lignes variables non essentielles libère ${money(freed)}/mois${remaining > 0 ? `, il reste ${money(remaining)} à trouver ailleurs` : ""}.`,
      ),
      steps: [
        ...lines,
        ...(remaining > 0 && vacation ? [T(`Or pause the “${vacation.name}” fund for a year: ${money(vacationMonthly)}/month.`, `Ou suspendez le fonds « ${vacation.name} » un an : ${money(vacationMonthly)}/mois.`)] : []),
        T("Track these categories at the monthly check-in; the app flags any that run 15 % over their 3-month average.", "Suivez ces catégories au bilan mensuel ; l’app signale celles qui dépassent de 15 % leur moyenne sur 3 mois."),
      ],
      impact: [
        { label: T("Freed", "Libéré"), value: `${money(freed)}${T("/month", "/mois")}`, tone: "good" },
        { label: T("LOC stops growing by", "La marge cesse de grossir de"), value: `${money(Math.min(freed, gap) * 12, { compact: true })}${T("/yr", "/an")}`, tone: "good" },
        ...impactOf(alt),
      ],
      caveats: [T("Percentages are rounded to 5 % and capped at 50 % per line so the budget stays livable.", "Pourcentages arrondis à 5 % et plafonnés à 50 % par ligne pour que le budget reste vivable.")],
      tryName: T("Advisor: close the gap", "Conseiller : combler l’écart"),
      tryOverrides: overrides,
    });
    if (vacation && vacationMonthly > 0) {
      const vo: ScenarioOverrides = { ...EMPTY_OVERRIDES, expenseCuts: [{ expenseId: vacation.id, pct: 100 }], extraMonthly: null };
      const va = run(vo);
      recs.push({
        id: "vacation-pause",
        horizon: "next",
        category: "cashflow",
        title: T("Decide the trip on purpose, not by default", "Décidez le voyage volontairement, pas par défaut"),
        why: T(
          `The vacation fund is ${money(vacationMonthly)}/month (${money(vacation.amountCents * (vacation.frequency === "ANNUAL" ? 1 : 12), { compact: true })} a year). While the budget is in deficit, that money is effectively borrowed on the line of credit at ${pct(locRate)}. Skipping one year removes ${Math.round((vacationMonthly / gap) * 100)} % of the gap.`,
          `Le fonds vacances est de ${money(vacationMonthly)}/mois (${money(vacation.amountCents * (vacation.frequency === "ANNUAL" ? 1 : 12), { compact: true })} par année). Tant que le budget est déficitaire, cet argent est en pratique emprunté sur la marge à ${pct(locRate)}. Sauter une année retire ${Math.round((vacationMonthly / gap) * 100)} % de l’écart.`,
        ),
        steps: [T("If you keep the trip, treat the vacation line as non-negotiable and cut elsewhere.", "Si vous gardez le voyage, considérez la ligne comme intouchable et coupez ailleurs."), T("If you skip a year, set the line's end date to today and re-add it next year.", "Si vous sautez une année, mettez la date de fin de la ligne à aujourd’hui et rajoutez-la l’an prochain.")],
        impact: impactOf(va),
        tryName: T("Advisor: no trip this year", "Conseiller : pas de voyage cette année"),
        tryOverrides: vo,
      });
    }
  }

  // ---------- 3. Credit cards ----------
  if (cards.length > 0) {
    const cardBal = cards.reduce((s, c) => s + c.balanceCents, 0);
    const cardInterest = cards.reduce((s, c) => s + (base.payoff.months[0]?.debts[c.id]?.interestCents ?? 0), 0);
    const cardMins = cards.reduce((s, c) => s + (base.payoff.months[0]?.debts[c.id]?.scheduledCents ?? 0), 0);
    const clearedMonths = cards.map((c) => base.payoff.payoffMonthByDebt[c.id]).filter((m): m is string => !!m).sort();
    const clearedBy = clearedMonths.length === cards.length ? clearedMonths[clearedMonths.length - 1] : null;
    const monthsToClear = clearedBy ? monthDiff(startMonth, clearedBy) + 1 : null;
    const transferSaving = loc ? cards.reduce((s, c) => s + Math.round((c.balanceCents * Math.max(0, (base.payoff.months[0]?.debts[c.id]?.rateBps ?? 0) - locRate)) / 10_000 / 12), 0) : 0;
    const nextLump = base.payoffInput.lumpSums.filter((l) => l.kind === "scheduled" && l.month >= startMonth).sort((a, c) => a.month.localeCompare(c.month))[0];
    const steps = [
      T("Stop putting new purchases on the cards until both read zero; use debit from the joint account.", "Ne mettez plus d’achats sur les cartes tant qu’elles ne sont pas à zéro ; utilisez le débit du compte conjoint."),
      ...(nextLump ? [T(`Apply the ${fm(nextLump.month)} ${nextLump.label.toLowerCase()} (${money(nextLump.cents, { compact: true })}) to the cards first, then the rest to the LOC.`, `Appliquez le ${nextLump.label.toLowerCase()} de ${fm(nextLump.month)} (${money(nextLump.cents, { compact: true })}) d’abord aux cartes, puis le reste à la marge.`)] : []),
      ...(loc && transferSaving > 0 && (monthsToClear === null || monthsToClear > 3)
        ? [T(`If the LOC has room, moving the ${money(cardBal, { compact: true })} onto it cuts interest from ${money(cardInterest)} to ${money(cardInterest - transferSaving)} a month — only worth it if the cards then stay at zero.`, `Si la marge a de la place, y transférer les ${money(cardBal, { compact: true })} réduit les intérêts de ${money(cardInterest)} à ${money(cardInterest - transferSaving)} par mois — utile seulement si les cartes restent ensuite à zéro.`)]
        : loc && monthsToClear !== null && monthsToClear <= 3
          ? [T(`A balance transfer is not worth the hassle: under the current plan the cards are cleared by ${fm(clearedBy!)}.`, `Un transfert de solde n’en vaut pas la peine : selon le plan actuel, les cartes sont réglées d’ici ${fm(clearedBy!)}.`)]
          : []),
      T(`Once the cards are gone, their ${money(cardMins)}/month of minimums rolls into the LOC automatically (roll-down is on).`, `Une fois les cartes réglées, leurs ${money(cardMins)}/mois de minimums basculent automatiquement sur la marge (report activé).`),
    ];
    recs.push({
      id: "cards",
      horizon: "now",
      category: "debt",
      title: T(`Get the ${money(cardBal, { compact: true })} off the credit cards first`, `Sortez d’abord les ${money(cardBal, { compact: true })} des cartes de crédit`),
      why: T(
        `The cards cost ${money(cardInterest)} a month in interest at ${cards.map((c) => pct(base.payoff.months[0]?.debts[c.id]?.rateBps ?? 0)).join(" / ")} — ${loc ? `${money(transferSaving)} more than the same balance on the LOC at ${pct(locRate)}` : "the most expensive money you owe"}. Their minimums (${money(cardMins)}/month) also tie up cash that the LOC needs.${clearedBy ? T(` Under today's plan they are cleared by ${fm(clearedBy)}.`, ` Selon le plan actuel, elles sont réglées d’ici ${fm(clearedBy)}.`) : ""}`,
        `Les cartes coûtent ${money(cardInterest)} par mois d’intérêts à ${cards.map((c) => pct(base.payoff.months[0]?.debts[c.id]?.rateBps ?? 0)).join(" / ")} — ${loc ? `${money(transferSaving)} de plus que le même solde sur la marge à ${pct(locRate)}` : "l’argent le plus cher que vous devez"}. Leurs minimums (${money(cardMins)}/mois) immobilisent aussi de l’argent dont la marge a besoin.${clearedBy ? ` Selon le plan actuel, elles sont réglées d’ici ${fm(clearedBy)}.` : ""}`,
      ),
      steps,
      impact: [
        { label: T("Interest now", "Intérêts actuels"), value: `${money(cardInterest)}${T("/month", "/mois")}`, tone: "act" },
        ...(clearedBy ? [{ label: T("Cleared by", "Réglées d’ici"), value: fm(clearedBy), tone: "good" as const }] : []),
        ...(transferSaving > 0 ? [{ label: T("If moved to the LOC", "Si transférées sur la marge"), value: `−${money(transferSaving)}${T("/month", "/mois")}`, tone: "good" as const }] : []),
      ],
      caveats: [T("Card rates and minimums are estimates until you enter the real ones on the Debt plan page.", "Les taux et minimums des cartes sont des estimations tant que vous n’entrez pas les vrais sur la page Plan de dettes.")],
    });
  }

  // ---------- 4. Order of repayment ----------
  {
    const av = run({ ...defaultOverrides, strategy: "AVALANCHE" });
    const lf = run({ ...defaultOverrides, strategy: "LOC_FIRST" });
    const diff = lf.payoff.consumerInterestCents - av.payoff.consumerInterestCents;
    if (defaultOverrides.strategy !== "AVALANCHE" && diff > 0) {
      recs.push({
        id: "strategy",
        horizon: "now",
        category: "debt",
        title: T("Switch the order: highest rate first", "Changez l’ordre : taux le plus élevé d’abord"),
        why: T(`Your default plan pays the LOC before the cards. Paying the highest rate first costs ${money(diff, { compact: true })} less in interest over the plan.`, `Votre plan par défaut rembourse la marge avant les cartes. Payer le taux le plus élevé d’abord coûte ${money(diff, { compact: true })} de moins en intérêts sur la durée du plan.`),
        steps: [T("On the Debt plan page, set the strategy to “Highest rate first” and save it as the default plan in Settings.", "Sur la page Plan de dettes, choisissez « Taux le plus élevé d’abord » et enregistrez-le comme plan par défaut dans Réglages.")],
        impact: impactOf(av),
        tryName: T("Advisor: highest rate first", "Conseiller : taux le plus élevé d’abord"),
        tryOverrides: { ...defaultOverrides, strategy: "AVALANCHE" },
      });
    } else if (diff > 0 && cards.length > 0) {
      recs.push({
        id: "strategy-keep",
        horizon: "now",
        category: "debt",
        title: T("Keep paying the highest rate first", "Continuez à payer le taux le plus élevé d’abord"),
        why: T(`Doing it the other way round (LOC first, cards later) would cost ${money(diff, { compact: true })} more in interest${monthsSooner(lf.payoff, av.payoff) ? T(` and finish ${monthsSooner(lf.payoff, av.payoff)} month(s) later`, ` et finirait ${monthsSooner(lf.payoff, av.payoff)} mois plus tard`) : ""}. Your plan already does this — this is the number that justifies it.`, `Faire l’inverse (marge d’abord, cartes ensuite) coûterait ${money(diff, { compact: true })} de plus en intérêts${monthsSooner(lf.payoff, av.payoff) ? ` et finirait ${monthsSooner(lf.payoff, av.payoff)} mois plus tard` : ""}. Votre plan le fait déjà — voici le chiffre qui le justifie.`),
        steps: [T("When a lump sum arrives, pay the card with the highest rate to zero before touching the LOC.", "Quand un montant forfaitaire arrive, mettez à zéro la carte au taux le plus élevé avant de toucher à la marge.")],
        impact: [{ label: T("LOC-first would cost", "Marge d’abord coûterait"), value: `+${money(diff, { compact: true })}`, tone: "watch" }],
      });
    }
  }

  // ---------- 5. LOC payment ----------
  if (loc) {
    const m0 = base.payoff.months[0]?.debts[loc.id];
    if (m0 && m0.scheduledCents <= m0.interestCents) {
      const fixed = Math.ceil((m0.interestCents + 100_00) / 50_00) * 50_00; // next 50 $ above interest + 100 $
      const extra = fixed - m0.scheduledCents;
      const alt = payoffWithExtra(base.payoffInput, extra);
      recs.push({
        id: "loc-fixed-payment",
        horizon: "now",
        category: "debt",
        title: T(`Set a fixed LOC payment of ${money(fixed, { compact: true })}`, `Fixez un paiement de marge de ${money(fixed, { compact: true })}`),
        why: T(`The LOC payment today is ${money(m0.scheduledCents)} against ${money(m0.interestCents)} of monthly interest, so nothing comes off the principal between lump sums. A fixed ${money(fixed, { compact: true })} guarantees ${money(extra)} of principal every month whatever the rate does.`, `Le paiement de marge est aujourd’hui de ${money(m0.scheduledCents)} contre ${money(m0.interestCents)} d’intérêts mensuels : rien ne réduit le capital entre les montants forfaitaires. Un paiement fixe de ${money(fixed, { compact: true })} garantit ${money(extra)} de capital chaque mois, quoi que fasse le taux.`),
        steps: [T(`Ask the bank to change the LOC from interest-only to a fixed ${money(fixed, { compact: true })} a month (or set a recurring transfer).`, `Demandez à la banque de passer la marge d’« intérêts seulement » à un paiement fixe de ${money(fixed, { compact: true })} par mois (ou programmez un virement).`), T("Then update the LOC minimum on the Debt plan page to “Fixed amount”.", "Puis mettez à jour le minimum de la marge sur la page Plan de dettes en « Montant fixe ».")],
        impact: impactOf(alt),
        caveats: [T("Counted as new money: with the budget in deficit, the extra must come from the cuts above.", "Compté comme argent neuf : avec un budget déficitaire, le supplément doit venir des coupes ci-dessus.")],
        tryName: T(`Advisor: fixed LOC payment ${money(fixed, { compact: true })}`, `Conseiller : paiement fixe ${money(fixed, { compact: true })}`),
        tryOverrides: { ...defaultOverrides, extraMonthly: { cents: extra } },
      });
    }
  }

  // ---------- 6. RESP grants ----------
  const resp = data.accounts.find((a) => a.type === "RESP");
  if (resp) {
    const respContribYear = data.contributions.filter((c) => c.accountId === resp.id && c.source !== "LUMP_SUM").reduce((s, c) => s + toMonthlyCents(c.amountCents, c.frequency) * 12, 0);
    if (respContribYear < RESP_TARGET_YEAR_CENTS) {
      const addYear = RESP_TARGET_YEAR_CENTS - respContribYear;
      const addMonthly = Math.round(addYear / 12);
      const grants = Math.round(RESP_TARGET_YEAR_CENTS * 0.3) - Math.round(respContribYear * 0.3);
      const locSaving = loc ? Math.round((addYear * locRate) / 10_000) : 0;
      const o: ScenarioOverrides = { ...defaultOverrides, extraContributions: [...defaultOverrides.extraContributions, { accountId: resp.id, cents: addMonthly }] };
      const alt = run(o);
      const idx = Math.min(18 * 12, alt.invest.months.length - 1);
      const with18 = alt.invest.months[idx]?.balances[resp.id] ?? 0;
      const without18 = base.invest.months[idx]?.balances[resp.id] ?? 0;
      recs.push({
        id: "resp",
        horizon: "now",
        category: "family",
        title: T(`Put ${money(addMonthly)}/month in ${resp.name} — the grants are a 30 % instant return`, `Mettez ${money(addMonthly)}/mois dans ${resp.name} — les subventions sont un rendement immédiat de 30 %`),
        why: T(
          `On the first ${money(RESP_TARGET_YEAR_CENTS, { compact: true })} a year, Ottawa adds 20 % (CESG) and Quebec 10 % (QESI): ${money(grants, { compact: true })} of free money every year. The same ${money(addYear, { compact: true })} on the LOC saves ${money(locSaving, { compact: true })} of interest. This is the one contribution that beats paying down debt even while the budget is tight.`,
          `Sur les premiers ${money(RESP_TARGET_YEAR_CENTS, { compact: true })} par année, Ottawa ajoute 20 % (SCEE) et Québec 10 % (IQEE) : ${money(grants, { compact: true })} d’argent gratuit chaque année. Le même ${money(addYear, { compact: true })} sur la marge économise ${money(locSaving, { compact: true })} d’intérêts. C’est la seule cotisation qui bat le remboursement de dette même quand le budget est serré.`,
        ),
        steps: [
          T(`Add a ${money(addMonthly)}/month line to ${resp.name} under Budget › Savings & investments (fund it from the cuts if needed).`, `Ajoutez une ligne de ${money(addMonthly)}/mois vers ${resp.name} dans Budget › Épargne et placements (financez-la par les coupes au besoin).`),
          T("Ask the RESP provider to confirm both grants are being requested; unused CESG room from an earlier year can be caught up (max 1 000 $ of CESG per year).", "Demandez au fournisseur du REEE de confirmer que les deux subventions sont demandées ; les droits SCEE inutilisés d’une année passée peuvent être rattrapés (max 1 000 $ de SCEE par année)."),
        ],
        impact: [
          { label: T("Grants", "Subventions"), value: `+${money(grants, { compact: true })}${T("/yr", "/an")}`, tone: "good" },
          { label: T("RESP in 18 years", "REEE dans 18 ans"), value: `${money(with18, { compact: true })} ${T("vs", "vs")} ${money(without18, { compact: true })}`, tone: "good" },
        ],
        caveats: [T(`Lifetime caps: CESG ${money(CESG_LIFETIME_CAP_CENTS, { compact: true })}, QESI ${money(QESI_LIFETIME_CAP_CENTS, { compact: true })}; annual caps ${money(CESG_ANNUAL_CAP_CENTS, { compact: true })} and ${money(QESI_ANNUAL_CAP_CENTS, { compact: true })}. Catch-up is not in the projection.`, `Plafonds à vie : SCEE ${money(CESG_LIFETIME_CAP_CENTS, { compact: true })}, IQEE ${money(QESI_LIFETIME_CAP_CENTS, { compact: true })} ; plafonds annuels ${money(CESG_ANNUAL_CAP_CENTS, { compact: true })} et ${money(QESI_ANNUAL_CAP_CENTS, { compact: true })}. Le rattrapage n’est pas dans la projection.`)],
      });
    }
  }

  // ---------- 7. Keep the payroll RRSPs ----------
  const payrollRrsp = data.contributions.filter((c) => c.source === "PAYROLL").map((c) => ({ c, a: data.accounts.find((x) => x.id === c.accountId) })).filter((x) => x.a?.type === "RRSP");
  if (payrollRrsp.length > 0 && loc && loc.balanceCents > 0) {
    const rows = payrollRrsp.map(({ c, a }) => {
      const gross = toMonthlyCents(c.amountCents, c.frequency);
      const owner = a!.owner;
      const rate = owner === "ALEX" ? rates.ALEX : owner === "SELIA" ? rates.SELIA : Math.round((rates.ALEX + rates.SELIA) / 2);
      const net = netOfTax(gross, owner, "RRSP", rates);
      const o: ScenarioOverrides = { ...defaultOverrides, redirects: [{ contributionId: c.id, months: 12, startMonth }] };
      const alt = run(o);
      const d = delta(alt);
      const forgone10y = Math.round(gross * 12 * Math.pow(1 + a!.returnBps / 10_000, 10));
      return { c, a: a!, gross, net, rate, alt, d, forgone10y, o };
    });
    const biggest = rows.sort((x, y) => y.gross - x.gross)[0];
    recs.push({
      id: "rrsp-keep",
      horizon: "now",
      category: "investing",
      title: T("Keep the payroll RRSP contributions — do not redirect them to the LOC", "Gardez les cotisations REER sur la paie — ne les redirigez pas vers la marge"),
      why: T(
        `${rows.map((r) => `${personName(r.a.owner)} puts ${money(r.gross)}/month in ${r.a.name} before tax; at a ${pct(r.rate, 1)} marginal rate the deduction is worth ${money(Math.round((r.gross * r.rate) / 10_000))}/month, so the real cost is only ${money(r.net)}`).join(". ")}. Stopping ${personName(biggest.a.owner)}'s for a year would send just ${money(biggest.net * 12, { compact: true })} to the LOC (debt-free ${biggest.d.sooner ?? 0} month(s) sooner, ${money(biggest.d.saved, { compact: true })} less interest) while giving up ${money(biggest.gross * 12, { compact: true })} of RRSP — about ${money(biggest.forgone10y, { compact: true })} in ten years at ${pct(biggest.a.returnBps, 1)} — plus any employer match.`,
        `${rows.map((r) => `${personName(r.a.owner)} met ${money(r.gross)}/mois dans ${r.a.name} avant impôt ; à un taux marginal de ${pct(r.rate, 1)}, la déduction vaut ${money(Math.round((r.gross * r.rate) / 10_000))}/mois, le coût réel n’est donc que ${money(r.net)}`).join(". ")}. Arrêter celle de ${personName(biggest.a.owner)} un an n’enverrait que ${money(biggest.net * 12, { compact: true })} à la marge (sans dette ${biggest.d.sooner ?? 0} mois plus tôt, ${money(biggest.d.saved, { compact: true })} d’intérêts en moins) tout en renonçant à ${money(biggest.gross * 12, { compact: true })} de REER — environ ${money(biggest.forgone10y, { compact: true })} dans dix ans à ${pct(biggest.a.returnBps, 1)} — plus toute contrepartie de l’employeur.`,
      ),
      steps: [
        T("Leave both group RRSP deductions exactly as they are.", "Laissez les deux retenues REER collectifs exactement telles quelles."),
        T("Check each plan's employer match: any matched portion is a 100 % return and must never be cut.", "Vérifiez la contrepartie de l’employeur de chaque régime : toute portion appariée est un rendement de 100 % et ne doit jamais être coupée."),
        T("If a tax refund arrives from these deductions, it is a lump sum for the cards/LOC — add it on the Debt plan page.", "Si un remboursement d’impôt découle de ces retenues, c’est un montant forfaitaire pour les cartes ou la marge — ajoutez-le sur la page Plan de dettes."),
      ],
      impact: [
        { label: T("Tax value of deductions", "Valeur fiscale des déductions"), value: `${money(rows.reduce((s, r) => s + Math.round((r.gross * r.rate) / 10_000), 0))}${T("/month", "/mois")}`, tone: "good" },
        { label: T("Redirecting the biggest for 12 months", "Rediriger la plus grosse 12 mois"), value: `${biggest.d.sooner ?? 0} ${T("months sooner", "mois plus tôt")} · −${money(biggest.d.saved, { compact: true })} ${T("interest", "intérêts")}`, tone: "watch" },
        { label: T("…but forgoes", "…mais renonce à"), value: `${money(biggest.forgone10y, { compact: true })} ${T("in 10 yrs", "dans 10 ans")}`, tone: "act" },
      ],
      caveats: [T("The ten-year RRSP figure is before tax on withdrawal; the LOC interest saved is after tax. Even so, the deduction plus any match makes the RRSP the better use of the same dollars at these rates.", "Le chiffre REER sur dix ans est avant impôt au retrait ; les intérêts de marge économisés sont après impôt. Même ainsi, la déduction plus toute contrepartie font du REER le meilleur usage des mêmes dollars à ces taux."), T(`Marginal rates are estimated from the gross salaries in Settings (${pct(rates.ALEX, 1)} / ${pct(rates.SELIA, 1)}), 2025 federal + Quebec brackets, before credits.`, `Taux marginaux estimés à partir des salaires bruts dans Réglages (${pct(rates.ALEX, 1)} / ${pct(rates.SELIA, 1)}), paliers fédéral + Québec 2025, avant crédits.`)],
      tryName: T(`See the trade-off: pause ${personName(biggest.a.owner)}'s RRSP 12 months`, `Voir le compromis : pause REER ${personName(biggest.a.owner)} 12 mois`),
      tryOverrides: biggest.o,
    });
  }

  // ---------- 8. TFSA: after the LOC ----------
  const tfsaLines = data.contributions.filter((c) => c.source === "SPENDING_ACCOUNT").map((c) => ({ c, a: data.accounts.find((x) => x.id === c.accountId) })).filter((x) => x.a?.type === "TFSA" || x.a?.type === "NON_REGISTERED");
  if (loc && loc.balanceCents > 0) {
    if (tfsaLines.length > 0) {
      const monthly = tfsaLines.reduce((s, x) => s + toMonthlyCents(x.c.amountCents, x.c.frequency), 0);
      const o: ScenarioOverrides = { ...defaultOverrides, redirects: [...defaultOverrides.redirects, ...tfsaLines.map((x) => ({ contributionId: x.c.id, months: 600, startMonth }))] };
      const alt = run(o);
      const worst = tfsaLines.sort((x, y) => (x.a!.returnBps) - (y.a!.returnBps))[0];
      recs.push({
        id: "tfsa-defer",
        horizon: "now",
        category: "investing",
        title: T(`Pause the ${money(monthly)}/month TFSA top-ups until the LOC is gone`, `Suspendez les ${money(monthly)}/mois de CELI jusqu’à ce que la marge soit remboursée`),
        why: T(`Every dollar on the LOC earns a guaranteed, tax-free ${pct(locRate)}. The TFSA line assumes ${pct(worst.a!.returnBps, 1)} — an expectation, not a guarantee, and only ${pct(worst.a!.returnBps - locRate, 2)} above the LOC. Redirecting the top-ups pays the LOC off ${alt.payoff.outcome.kind === "paid" && delta(alt).sooner ? `${delta(alt).sooner} month(s) sooner` : "sooner"} and saves ${money(delta(alt).saved, { compact: true })} of interest; the TFSA room is not lost, it carries forward.`, `Chaque dollar sur la marge rapporte un ${pct(locRate)} garanti et non imposable. La ligne CELI suppose ${pct(worst.a!.returnBps, 1)} — une attente, pas une garantie, et seulement ${pct(worst.a!.returnBps - locRate, 2)} au-dessus de la marge. Rediriger ces montants rembourse la marge ${alt.payoff.outcome.kind === "paid" && delta(alt).sooner ? `${delta(alt).sooner} mois plus tôt` : "plus tôt"} et économise ${money(delta(alt).saved, { compact: true })} d’intérêts ; les droits CELI ne sont pas perdus, ils se reportent.`),
        steps: [T("Set an end date on the TFSA contribution line(s) in the Budget, and add the same amount as a fixed extra LOC payment.", "Mettez une date de fin sur la ou les lignes CELI du Budget, et ajoutez le même montant en paiement supplémentaire fixe sur la marge."), T("The day the LOC reads zero, restart the TFSA with the full freed amount (see the plan below).", "Le jour où la marge est à zéro, redémarrez le CELI avec tout le montant libéré (voir le plan ci-dessous).")],
        impact: impactOf(alt),
        tryName: T("Advisor: TFSA money to the LOC", "Conseiller : argent CELI vers la marge"),
        tryOverrides: o,
      });
    }
    // Plan for after payoff
    if (base.payoff.outcome.kind === "paid") {
      const payoffMonth = base.payoff.outcome.month;
      const freed = data.debts.filter((d) => d.includeInPayoff).reduce((s, d) => s + (base.payoff.months[0]?.debts[d.id]?.scheduledCents ?? 0), 0) + (defaultOverrides.extraMonthly?.cents ?? 0) + b.debtPaydownIncomeCents;
      const tfsaRoom = rooms.filter((r) => r.accountType === "TFSA").reduce((s, r) => s + r.roomCents, 0);
      const years = 10;
      const rBps = data.settings.defaultReturnBps;
      const rm = monthlyRate(rBps);
      const fv = Math.round(freed * ((Math.pow(1 + rm, years * 12) - 1) / rm));
      const monthsToFillRoom = tfsaRoom > 0 && freed > 0 ? Math.ceil(tfsaRoom / freed) : null;
      recs.push({
        id: "after-payoff",
        horizon: "later",
        category: "investing",
        title: T(`From ${fm(payoffMonth)}: move the freed ${money(freed, { compact: true })}/month straight into the TFSAs`, `À partir de ${fm(payoffMonth)} : envoyez les ${money(freed, { compact: true })}/mois libérés directement dans les CELI`),
        why: T(`When the last consumer debt is paid, ${money(freed, { compact: true })} a month (today's minimums, extra and child-care payment) stops going to interest. Kept invested at ${pct(rBps, 1)}, that is about ${money(fv, { compact: true })} after ${years} years. ${tfsaRoom > 0 ? `You have ${money(tfsaRoom, { compact: true })} of TFSA room between you — at that pace it takes ${monthsToFillRoom} months to use it, all of it tax-free.` : "Enter your TFSA room in Investments to size this."}`, `Quand la dernière dette à la consommation est payée, ${money(freed, { compact: true })} par mois (minimums, supplément et allocation de garde actuels) cessent d’aller aux intérêts. Investi à ${pct(rBps, 1)}, cela représente environ ${money(fv, { compact: true })} après ${years} ans. ${tfsaRoom > 0 ? `Vous avez ${money(tfsaRoom, { compact: true })} de droits CELI à vous deux — à ce rythme, il faut ${monthsToFillRoom} mois pour les utiliser, le tout à l’abri de l’impôt.` : "Entrez vos droits CELI dans Placements pour dimensionner ceci."}`),
        steps: [T("Set up the automatic TFSA transfer for the month after payoff, before lifestyle absorbs the money.", "Programmez le virement CELI automatique pour le mois suivant le remboursement, avant que le train de vie n’absorbe l’argent."), T("TFSA before RRSP top-ups: your payroll RRSPs already use most of the annual room.", "CELI avant les REER additionnels : vos REER sur la paie utilisent déjà l’essentiel des droits annuels.")],
        impact: [{ label: T("Freed at payoff", "Libéré au remboursement"), value: `${money(freed, { compact: true })}${T("/month", "/mois")}`, tone: "good" }, { label: T(`Value after ${years} yrs`, `Valeur après ${years} ans`), value: money(fv, { compact: true }), tone: "good" }],
      });
    }
  }

  // ---------- 9. Emergency fund ----------
  const cash = data.accounts.filter((a) => a.type === "CASH").reduce((s, a) => s + a.balanceCents, 0);
  if (loc) {
    const monthsCovered = committedAll > 0 ? cash / committedAll : 0;
    const oneMonth = committedAll;
    recs.push({
      id: "emergency-fund",
      horizon: cards.length > 0 ? "later" : "next",
      category: "cashflow",
      title: T(`Keep the emergency fund at ${money(Math.max(cash, data.settings.cashBufferCents), { compact: true })} for now`, `Gardez le fonds d’urgence à ${money(Math.max(cash, data.settings.cashBufferCents), { compact: true })} pour l’instant`),
      why: T(`${money(cash, { compact: true })} covers ${monthsCovered.toFixed(1)} month of your ${money(committedAll, { compact: true })} of monthly outflows. Normally that is far too thin — but building cash at 0 % while paying ${cards.length ? "20 % on cards and " : ""}${pct(locRate)} on the LOC costs more than it protects. The LOC's undrawn room is your safety net during the payoff.`, `${money(cash, { compact: true })} couvre ${monthsCovered.toFixed(1)} mois de vos ${money(committedAll, { compact: true })} de sorties mensuelles. Normalement c’est beaucoup trop mince — mais accumuler de l’encaisse à 0 % en payant ${cards.length ? "20 % sur les cartes et " : ""}${pct(locRate)} sur la marge coûte plus que ça ne protège. La marge non utilisée est votre filet de sécurité pendant le remboursement.`),
      steps: [
        T(`Do not grow it while any card balance remains${cards.length === 0 ? " (done)" : ""}.`, `Ne l’augmentez pas tant qu’il reste un solde de carte${cards.length === 0 ? " (fait)" : ""}.`),
        T(`Once the LOC is below ${money(20_000_00, { compact: true })}, build toward one month of outflows: ${money(oneMonth, { compact: true })}.`, `Une fois la marge sous ${money(20_000_00, { compact: true })}, visez un mois de sorties : ${money(oneMonth, { compact: true })}.`),
        T("Confirm the LOC limit with the bank so you know exactly how much room the safety net has.", "Confirmez la limite de la marge avec la banque pour savoir exactement quelle marge de manœuvre reste."),
      ],
      impact: [{ label: T("Coverage", "Couverture"), value: `${monthsCovered.toFixed(1)} ${T("month", "mois")}`, tone: "watch" }, { label: T("1-month target (later)", "Cible 1 mois (plus tard)"), value: money(oneMonth, { compact: true }) }],
    });
  }

  // ---------- 10. Bonuses ----------
  const bonuses = data.bonuses.filter((x) => x.confidence === "UNCONFIRMED" && x.amountCents > 0);
  if (bonuses.length > 0 && base.payoff.outcome.kind === "paid") {
    const wb = run(defaultOverrides, true);
    const total = bonuses.reduce((s, x) => s + Math.round((x.amountCents * x.pctAppliedBps) / 10_000), 0);
    recs.push({
      id: "bonus",
      horizon: "next",
      category: "debt",
      title: T(`When the bonuses land, send ${money(total, { compact: true })} to debt the same week`, `Quand les bonis arrivent, envoyez ${money(total, { compact: true })} à la dette la même semaine`),
      why: T(`Applied to the cards then the LOC, the expected bonuses finish the plan ${monthsSooner(base.payoff, wb.payoff) ?? 0} month(s) sooner and save ${money(delta(wb).saved, { compact: true })} of interest. They are not counted in the baseline until you confirm them.`, `Appliqués aux cartes puis à la marge, les bonis attendus terminent le plan ${monthsSooner(base.payoff, wb.payoff) ?? 0} mois plus tôt et économisent ${money(delta(wb).saved, { compact: true })} d’intérêts. Ils ne comptent pas dans la référence tant que vous ne les confirmez pas.`),
      steps: [T("Bonuses are taxed at your marginal rate at source; enter the net amount received.", "Les bonis sont imposés à la source au taux marginal ; entrez le montant net reçu."), T("Confirm each bonus on the Debt plan › Bonuses tab the day it is received; that creates the real payment.", "Confirmez chaque boni dans Plan de dettes › Bonis le jour de sa réception ; cela crée le paiement réel.")],
      impact: impactOf(wb),
    });
  }

  // ---------- 11. Leases ----------
  const leases = data.debts.filter((d) => d.type === "LEASE");
  if (leases.length > 0 && loc) {
    const payment = leases.reduce((s, l) => s + l.minimumCents, 0);
    const missing = leases.filter((l) => !l.endDate);
    const one = leases[0].minimumCents;
    const alt = payoffWithExtra(base.payoffInput, one);
    recs.push({
      id: "leases",
      horizon: "next",
      category: "debt",
      title: T(`Two cars cost ${money(payment, { compact: true })}/month — plan the end of each lease`, `Deux voitures coûtent ${money(payment, { compact: true })}/mois — planifiez la fin de chaque location`),
      why: T(`The leases are the largest non-mortgage outflow. If one ${money(one)} payment ended today and rolled into the LOC, you would be debt-free ${delta(alt).sooner ?? 0} month(s) sooner and pay ${money(delta(alt).saved, { compact: true })} less interest.${missing.length ? ` ${missing.map((l) => l.name).join(" and ")} ${missing.length > 1 ? "have" : "has"} no end date entered yet, so the plan cannot count on it.` : ""}`, `Les locations sont la plus grosse sortie hors hypothèque. Si un paiement de ${money(one)} se terminait aujourd’hui et basculait sur la marge, vous seriez sans dette ${delta(alt).sooner ?? 0} mois plus tôt avec ${money(delta(alt).saved, { compact: true })} d’intérêts en moins.${missing.length ? ` ${missing.map((l) => l.name).join(" et ")} n’${missing.length > 1 ? "ont" : "a"} pas encore de date de fin, le plan ne peut donc pas compter dessus.` : ""}`),
      steps: [
        ...(missing.length ? [T("Enter each lease's end date on Debt plan › Our debts; roll-down will then schedule the freed payment automatically.", "Entrez la date de fin de chaque location dans Plan de dettes › Nos dettes ; le report programmera automatiquement le paiement libéré.")] : []),
        T("Before the next car decision, run the plan with that payment at zero — the difference is the true cost of the replacement.", "Avant la prochaine décision de voiture, faites tourner le plan avec ce paiement à zéro — la différence est le vrai coût du remplacement."),
      ],
      impact: impactOf(alt),
      tryName: T("Advisor: one lease payment to the LOC", "Conseiller : un paiement de location vers la marge"),
      tryOverrides: { ...defaultOverrides, extraMonthly: { cents: one } },
    });
  }

  // ---------- 12. Mortgage renewal ----------
  const mortgage = data.debts.find((d) => d.type === "MORTGAGE");
  if (mortgage && mortgage.renewalDate) {
    const perPoint = Math.round((mortgage.balanceCents * 100) / 10_000 / 12);
    const renewalKey = mortgage.renewalDate.slice(0, 7) as MonthKey;
    const monthsAway = monthDiff(startMonth, renewalKey);
    recs.push({
      id: "mortgage-renewal",
      horizon: monthsAway <= 6 ? "next" : "later",
      category: "debt",
      title: T(`Mortgage renewal ${fm(renewalKey)}: each 1 % is ${money(perPoint, { compact: true })}/month`, `Renouvellement hypothécaire ${fm(renewalKey)} : chaque 1 % vaut ${money(perPoint, { compact: true })}/mois`),
      why: T(`On a ${money(mortgage.balanceCents, { compact: true })} balance, one percentage point of rate is ${money(perPoint, { compact: true })} a month — more than any flexible category. The renewal is ${monthsAway} months away.`, `Sur un solde de ${money(mortgage.balanceCents, { compact: true })}, un point de pourcentage de taux représente ${money(perPoint, { compact: true })} par mois — plus que n’importe quelle catégorie variable. Le renouvellement est dans ${monthsAway} mois.`),
      steps: [T("Four months before renewal, get at least three quotes (the current lender's first offer is rarely the best).", "Quatre mois avant le renouvellement, obtenez au moins trois offres (la première de votre prêteur actuel est rarement la meilleure)."), T("Check the mortgage's amortization and renewal date on the Debt plan page — both are estimates today.", "Vérifiez l’amortissement et la date de renouvellement sur la page Plan de dettes — ce sont des estimations aujourd’hui.")],
      impact: [{ label: T("Per 1 % of rate", "Par 1 % de taux"), value: `${money(perPoint, { compact: true })}${T("/month", "/mois")}`, tone: "watch" }],
    });
  }

  // ---------- 13. Housekeeping ----------
  {
    const steps: string[] = [];
    const nowKey = startMonth;
    if (!snapshots.some((s) => s.month === nowKey)) steps.push(T("Do this month's check-in (5 minutes): it re-anchors every projection on real balances.", "Faites le bilan du mois (5 minutes) : il réancre toutes les projections sur les vrais soldes."));
    const stale = data.accounts.filter((a) => !data.accounts.some((c) => c.parentId === a.id) && (now.getTime() - new Date(a.balanceAsOf).getTime()) / 86_400_000 > 90);
    if (stale.length) steps.push(T(`Update ${stale.length} investment balance(s) older than 90 days: ${stale.map((a) => a.name).join(", ")}.`, `Mettez à jour ${stale.length} solde(s) de placement de plus de 90 jours : ${stale.map((a) => a.name).join(", ")}.`));
    const estDebts = data.debts.filter((d) => d.notes?.toLowerCase().startsWith("estimate"));
    if (estDebts.length) steps.push(T(`Enter the real rate and minimum for: ${estDebts.map((d) => d.name).join(", ")}.`, `Entrez le vrai taux et le vrai minimum pour : ${estDebts.map((d) => d.name).join(", ")}.`));
    const estRooms = rooms.length === 0;
    if (estRooms) steps.push(T("Enter TFSA and RRSP contribution room from your CRA notice of assessment.", "Entrez les droits CELI et REER d’après votre avis de cotisation de l’ARC."));
    if (!data.settings.alexGrossIncomeCents || !data.settings.seliaGrossIncomeCents) steps.push(T("Enter both gross salaries in Settings so the RRSP advice uses your real tax rates.", "Entrez les deux salaires bruts dans Réglages pour que les conseils REER utilisent vos vrais taux d’imposition."));
    if (steps.length) {
      recs.push({
        id: "housekeeping",
        horizon: "housekeeping",
        category: "housekeeping",
        title: T("Keep the numbers honest", "Gardez les chiffres honnêtes"),
        why: T("Advice is only as good as the balances behind it. These take a few minutes and remove the biggest sources of error.", "Un conseil vaut ce que valent les soldes derrière lui. Ceci prend quelques minutes et retire les plus grosses sources d’erreur."),
        steps,
        impact: [],
      });
    }
  }

  // ---------- ordering, summary, assumptions ----------
  const order: Record<Horizon, number> = { now: 0, next: 1, later: 2, housekeeping: 3 };
  recs.sort((a, c) => order[a.horizon] - order[c.horizon]);
  const top = recs.filter((r) => r.horizon === "now").slice(0, 5);
  const headline = base.payoff.outcome.kind === "paid"
    ? T(`On today's numbers you are debt-free in ${fm(base.payoff.outcome.month)} and pay ${money(base.payoff.consumerInterestCents, { compact: true })} of interest getting there. Here is what would change that, in the order I would do it.`, `Avec les chiffres d’aujourd’hui, vous êtes sans dette en ${fm(base.payoff.outcome.month)} et payez ${money(base.payoff.consumerInterestCents, { compact: true })} d’intérêts pour y arriver. Voici ce qui changerait cela, dans l’ordre où je le ferais.`)
    : T("On today's numbers the debt never reaches zero. Here is what would change that, in the order I would do it.", "Avec les chiffres d’aujourd’hui, la dette n’atteint jamais zéro. Voici ce qui changerait cela, dans l’ordre où je le ferais.");
  const assumptions = [
    T(`Plan used as the baseline: ${defaultOverrides.strategy === "AVALANCHE" ? "highest rate first" : defaultOverrides.strategy === "SNOWBALL" ? "smallest balance first" : "LOC first"}, roll-down ${defaultOverrides.rollDown ? "on" : "off"}.`, `Plan de référence : ${defaultOverrides.strategy === "AVALANCHE" ? "taux le plus élevé d’abord" : defaultOverrides.strategy === "SNOWBALL" ? "plus petit solde d’abord" : "marge d’abord"}, report ${defaultOverrides.rollDown ? "activé" : "désactivé"}.`),
    ...(loc ? [T(`LOC at ${pct(locRate)} (variable); a 1 % rise adds ${money(Math.round((loc.balanceCents * 100) / 10_000 / 12))}/month of interest.`, `Marge à ${pct(locRate)} (variable) ; une hausse de 1 % ajoute ${money(Math.round((loc.balanceCents * 100) / 10_000 / 12))}/mois d’intérêts.`)] : []),
    T(`Investment returns as set per account (default ${pct(data.settings.defaultReturnBps, 1)}); RESP grants at 20 % + 10 % with annual and lifetime caps; no employer match modelled.`, `Rendements tels que définis par compte (défaut ${pct(data.settings.defaultReturnBps, 1)}) ; subventions REEE à 20 % + 10 % avec plafonds annuels et à vie ; aucune contrepartie d’employeur modélisée.`),
    T(`Marginal tax rates ${pct(rates.ALEX, 1)} (${personName("ALEX")}) and ${pct(rates.SELIA, 1)} (${personName("SELIA")}) from the gross salaries in Settings, 2025 federal + Quebec brackets, before credits.`, `Taux marginaux ${pct(rates.ALEX, 1)} (${personName("ALEX")}) et ${pct(rates.SELIA, 1)} (${personName("SELIA")}) d’après les salaires bruts dans Réglages, paliers fédéral + Québec 2025, avant crédits.`),
    T("“Sooner” and “interest” figures compare each idea with today's default plan, everything else unchanged. Extra payments are treated as new money.", "Les chiffres « plus tôt » et « intérêts » comparent chaque idée au plan par défaut actuel, tout le reste étant inchangé. Les paiements supplémentaires sont traités comme de l’argent neuf."),
  ];
  void addMonths;
  return { headline, summary: top.map((r) => r.title), recommendations: recs, assumptions };
}
