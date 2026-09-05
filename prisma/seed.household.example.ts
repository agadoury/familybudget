import type { SeedData } from "../src/lib/seed/types";

/**
 * Copy this file to prisma/seed.household.ts (gitignored) and fill in your real numbers,
 * then run: SEED_PROFILE=household npm run db:seed
 * The structure is the same as src/lib/seed/demo.ts — see it for a complete example.
 */
export const householdSeed: SeedData = {
  settings: { alexName: "Alex", seliaName: "Sélia", homeValue: 0, cashBuffer: 2_000, defaultReturnPct: 6 },
  accounts: [
    { key: "cash", owner: "JOINT", name: "Emergency fund", type: "CASH", balance: 2_000, asOf: "2026-09-01", returnPct: 0 },
  ],
  incomes: [
    { key: "a_sal", person: "ALEX", name: "Salary → joint account", amount: 0, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: "2026-09-01" },
    { key: "s_sal", person: "SELIA", name: "Salary → joint account", amount: 0, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: "2026-09-01" },
  ],
  expenses: [
    { name: "Groceries", category: "Groceries", amount: 0, frequency: "MONTHLY", type: "FLEXIBLE", essential: true, startDate: "2026-09-01" },
  ],
  debts: [
    { key: "loc", name: "Line of credit", type: "LOC", balance: 0, asOf: "2026-09-01", ratePct: 5.95, rateSince: "2026-09-01", minimum: { type: "INTEREST_ONLY" }, priority: 20, includeInPayoff: true, includeInNetWorth: true },
  ],
  lumpSumSchedules: [],
  contributions: [],
  contributionRoom: [],
  scenarios: [{ name: "Baseline", isBaseline: true, overrides: {} }],
  bonuses: [],
};
