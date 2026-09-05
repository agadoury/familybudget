/**
 * Approximate combined federal + Quebec marginal tax rates (2025 brackets, federal
 * abatement of 16.5 % applied, before personal credits). Used ONLY to estimate the
 * value of an RRSP deduction and the after-tax cash from stopping a payroll deduction.
 * Thresholds are taxable income in cents; rates in basis points.
 */
export const QC_MARGINAL_BRACKETS: { upToCents: number; bps: number }[] = [
  { upToCents: 53_255_00, bps: 2650 },
  { upToCents: 57_375_00, bps: 3150 },
  { upToCents: 106_495_00, bps: 3610 },
  { upToCents: 114_750_00, bps: 4110 },
  { upToCents: 129_590_00, bps: 4570 },
  { upToCents: 177_882_00, bps: 4750 },
  { upToCents: 253_414_00, bps: 5020 },
  { upToCents: Infinity, bps: 5330 },
];

export const DEFAULT_MARGINAL_BPS = 4000;

/** Marginal rate at a given gross income; falls back to a stated default when unknown (0). */
export function marginalRateBps(grossIncomeCents: number): number {
  if (!grossIncomeCents || grossIncomeCents <= 0) return DEFAULT_MARGINAL_BPS;
  for (const b of QC_MARGINAL_BRACKETS) if (grossIncomeCents <= b.upToCents) return b.bps;
  return QC_MARGINAL_BRACKETS[QC_MARGINAL_BRACKETS.length - 1].bps;
}
