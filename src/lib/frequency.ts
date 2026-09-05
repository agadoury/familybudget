/** Frequency normalisation. Mirrors the Prisma `Frequency` enum. */

export type Frequency =
  | "WEEKLY"
  | "BI_WEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "ONE_TIME";

export const FREQUENCIES: Frequency[] = [
  "WEEKLY",
  "BI_WEEKLY",
  "SEMI_MONTHLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "ONE_TIME",
];

/** Occurrences per year. ONE_TIME is 0 (it never recurs). */
export function perYear(f: Frequency): number {
  switch (f) {
    case "WEEKLY":
      return 52;
    case "BI_WEEKLY":
      return 26;
    case "SEMI_MONTHLY":
      return 24;
    case "MONTHLY":
      return 12;
    case "QUARTERLY":
      return 4;
    case "ANNUAL":
      return 1;
    case "ONE_TIME":
      return 0;
  }
}

/**
 * Convert an amount in cents at a frequency to an average monthly amount in cents.
 * Annual and quarterly items therefore become their monthly sinking-fund amount.
 * ONE_TIME items contribute 0 per month.
 */
export function toMonthlyCents(amountCents: number, f: Frequency): number {
  if (f === "ONE_TIME") return 0;
  return Math.round((amountCents * perYear(f)) / 12);
}

export function toAnnualCents(amountCents: number, f: Frequency): number {
  return amountCents * perYear(f);
}

/** "YYYY-MM" month keys, used by both engines to avoid timezone arithmetic. */
export type MonthKey = string;

export function monthKey(d: Date): MonthKey {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyFromParts(year: number, month1to12: number): MonthKey {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

export function parseMonthKey(k: MonthKey): { year: number; month: number } {
  const [y, m] = k.split("-").map(Number);
  return { year: y, month: m };
}

export function addMonths(k: MonthKey, n: number): MonthKey {
  const { year, month } = parseMonthKey(k);
  const idx = year * 12 + (month - 1) + n;
  return monthKeyFromParts(Math.floor(idx / 12), (idx % 12) + 1);
}

/** Number of months from a to b (b − a). */
export function monthDiff(a: MonthKey, b: MonthKey): number {
  const pa = parseMonthKey(a);
  const pb = parseMonthKey(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

/** First day of the month as a UTC date (what we store in @db.Date columns). */
export function monthKeyToDate(k: MonthKey): Date {
  const { year, month } = parseMonthKey(k);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Last day of the month, UTC. */
export function monthEndDate(k: MonthKey): Date {
  const { year, month } = parseMonthKey(k);
  return new Date(Date.UTC(year, month, 0));
}

/** Is a dated line active during a month? A line is active from its start month through its end month inclusive. */
export function activeInMonth(
  k: MonthKey,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): boolean {
  const s = start ? monthKey(new Date(start)) : null;
  const e = end ? monthKey(new Date(end)) : null;
  if (s && k < s) return false;
  if (e && k > e) return false;
  return true;
}

export function formatMonth(k: MonthKey, locale: "fr-CA" | "en-CA" = "en-CA"): string {
  const d = monthKeyToDate(k);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
