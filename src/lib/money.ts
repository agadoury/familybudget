/** Money helpers. All amounts are integer cents. */

export type Cents = number;

export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

/** Round half away from zero to an integer number of cents. */
export function roundCents(x: number): Cents {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Basis points → decimal rate (595 → 0.0595). */
export function bpsToRate(bps: number): number {
  return bps / 10_000;
}

export function rateToBps(rate: number): number {
  return Math.round(rate * 10_000);
}

/**
 * fr-CA style "12 345,67 $" (narrow no-break space as group separator, as Intl produces),
 * or en-CA "$12,345.67". `compact` drops the cents.
 */
export function formatMoney(
  cents: Cents,
  opts: { locale?: "fr-CA" | "en-CA"; compact?: boolean; sign?: boolean } = {},
): string {
  const { locale = "fr-CA", compact = false, sign = false } = opts;
  const value = cents / 100;
  const s = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
    signDisplay: sign ? "exceptZero" : "auto",
  }).format(value);
  return s;
}

export function formatPct(bps: number, locale: "fr-CA" | "en-CA" = "fr-CA", digits = 2): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(bps / 10_000);
}

/** Parse a user-typed amount ("1 234,56", "1,234.56", "1234") to cents. Returns null when invalid. */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[\s  $]/g, "");
  if (!cleaned) return null;
  // If both , and . present, the last one is the decimal separator.
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return toCents(n);
}
