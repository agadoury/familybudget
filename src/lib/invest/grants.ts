/**
 * RESP government grants (see DECISIONS.md #6).
 * CESG: 20 % of contributions, max 500 $/year, 7 200 $ lifetime.
 * QESI: 10 % of contributions, max 250 $/year, 3 600 $ lifetime.
 * Carry-forward of unused room is not modelled.
 */
export const CESG_RATE = 0.2;
export const CESG_ANNUAL_CAP_CENTS = 500_00;
export const CESG_LIFETIME_CAP_CENTS = 7_200_00;
export const QESI_RATE = 0.1;
export const QESI_ANNUAL_CAP_CENTS = 250_00;
export const QESI_LIFETIME_CAP_CENTS = 3_600_00;

export interface GrantTracker {
  year: number;
  cesgYear: number;
  qesiYear: number;
  cesgLife: number;
  qesiLife: number;
}

export function grantsForContribution(t: GrantTracker, year: number, contributionCents: number) {
  if (year !== t.year) {
    t.year = year;
    t.cesgYear = 0;
    t.qesiYear = 0;
  }
  const cesg = Math.max(
    0,
    Math.min(
      Math.round(contributionCents * CESG_RATE),
      CESG_ANNUAL_CAP_CENTS - t.cesgYear,
      CESG_LIFETIME_CAP_CENTS - t.cesgLife,
    ),
  );
  const qesi = Math.max(
    0,
    Math.min(
      Math.round(contributionCents * QESI_RATE),
      QESI_ANNUAL_CAP_CENTS - t.qesiYear,
      QESI_LIFETIME_CAP_CENTS - t.qesiLife,
    ),
  );
  t.cesgYear += cesg;
  t.qesiYear += qesi;
  t.cesgLife += cesg;
  t.qesiLife += qesi;
  return { cesg, qesi };
}
