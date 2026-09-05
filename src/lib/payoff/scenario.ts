import { z } from "zod";

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

/**
 * Scenario overrides, stored as JSON on `Scenario.overrides`.
 * Everything is relative to the baseline; ids point at Budget/Investments rows so
 * cuts and redirects are pulled from real lines, never retyped.
 */
export const scenarioOverridesSchema = z.object({
  v: z.literal(1).default(1),
  extraMonthly: z
    .object({
      cents: z.number().int().min(0).max(50_000_00),
      startMonth: monthKey.nullable().optional(),
      endMonth: monthKey.nullable().optional(),
    })
    .nullable()
    .optional(),
  lumpSums: z
    .array(z.object({ month: monthKey, cents: z.number().int().min(0), label: z.string().min(1).max(80) }))
    .default([]),
  rateChanges: z
    .array(z.object({ debtId: z.string(), month: monthKey, annualRateBps: z.number().int().min(0).max(10_000) }))
    .default([]),
  expenseCuts: z
    .array(
      z
        .object({
          expenseId: z.string().optional(),
          category: z.string().optional(),
          cents: z.number().int().min(0).optional(),
          pct: z.number().min(0).max(100).optional(),
        })
        .refine((c) => c.expenseId || c.category, { message: "expenseId or category required" })
        .refine((c) => c.cents !== undefined || c.pct !== undefined, { message: "cents or pct required" }),
    )
    .default([]),
  /** Redirect a savings/investment contribution to debt for N months. */
  redirects: z
    .array(
      z.object({
        contributionId: z.string(),
        months: z.number().int().min(1).max(600),
        startMonth: monthKey.nullable().optional(),
      }),
    )
    .default([]),
  /** Stock-plan lump-sum schedule overrides (amount per withdrawal). */
  lumpSumScheduleCents: z.record(z.string(), z.number().int().min(0)).default({}),
  strategy: z.enum(["AVALANCHE", "SNOWBALL", "LOC_FIRST"]).default("AVALANCHE"),
  rollDown: z.boolean().default(true),
  /** Global return assumption override for the investment projection (bps). */
  returnBps: z.number().int().min(0).max(5000).nullable().optional(),
  /** Extra monthly contributions added on the Investments page what-if (accountId → cents). */
  extraContributions: z.array(z.object({ accountId: z.string(), cents: z.number().int().min(0) })).default([]),
  /** Pause all contributions for N months starting at startMonth. */
  contributionPause: z
    .object({ months: z.number().int().min(1).max(600), startMonth: monthKey.nullable().optional() })
    .nullable()
    .optional(),
});

export type ScenarioOverrides = z.infer<typeof scenarioOverridesSchema>;

export const EMPTY_OVERRIDES: ScenarioOverrides = scenarioOverridesSchema.parse({});

export function parseOverrides(json: unknown): ScenarioOverrides {
  const r = scenarioOverridesSchema.safeParse(json ?? {});
  return r.success ? r.data : EMPTY_OVERRIDES;
}
