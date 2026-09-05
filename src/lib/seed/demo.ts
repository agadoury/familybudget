import type { SeedData } from "./types";

/** Realistic-looking demo data so the app never looks empty. Not our real numbers. */
const AS_OF = "2026-09-01";

export const demoSeed: SeedData = {
  settings: { alexName: "Alex", seliaName: "Sélia", homeValue: 650_000, cashBuffer: 2_000, defaultReturnPct: 6, alexGrossIncome: 95_000, seliaGrossIncome: 78_000 },
  accounts: [
    { key: "a_rrsp", owner: "ALEX", name: "Alex RRSP", type: "RRSP", balance: 0, asOf: AS_OF },
    { key: "a_rrsp_ind", owner: "ALEX", name: "Brokerage RRSP", type: "RRSP", subType: "individual", parentKey: "a_rrsp", balance: 42_500, asOf: AS_OF },
    { key: "a_rrsp_grp", owner: "ALEX", name: "Group RRSP", type: "RRSP", subType: "group", parentKey: "a_rrsp", balance: 18_200, asOf: AS_OF },
    { key: "a_tfsa", owner: "ALEX", name: "Alex TFSA", type: "TFSA", balance: 6_800, asOf: AS_OF },
    { key: "s_rrsp", owner: "SELIA", name: "Sélia RRSP", type: "RRSP", balance: 0, asOf: AS_OF },
    { key: "s_rrsp_grp", owner: "SELIA", name: "Group RRSP", type: "RRSP", subType: "group", parentKey: "s_rrsp", balance: 12_400, asOf: AS_OF },
    { key: "s_tfsa", owner: "SELIA", name: "Sélia TFSA", type: "TFSA", balance: 3_100, asOf: "2026-05-15" },
    { key: "resp", owner: "JOINT", name: "Kid's RESP", type: "RESP", balance: 2_500, asOf: AS_OF, includeInNetWorth: false },
    { key: "cash", owner: "JOINT", name: "Emergency fund", type: "CASH", balance: 2_000, asOf: AS_OF, returnPct: 0 },
  ],
  incomes: [
    { key: "a_sal", person: "ALEX", name: "Salary → joint account", amount: 2_400, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: "2026-01-01" },
    { key: "a_rrsp", person: "ALEX", name: "RRSP (payroll)", amount: 300, frequency: "SEMI_MONTHLY", destination: "RRSP", accountKey: "a_rrsp_grp", startDate: "2026-01-01" },
    { key: "a_stock", person: "ALEX", name: "Stock plan", amount: 250, frequency: "SEMI_MONTHLY", destination: "STOCK_PLAN", startDate: "2026-01-01", notes: "Withdrawn April and November" },
    { key: "s_sal", person: "SELIA", name: "Salary → joint account", amount: 2_000, frequency: "SEMI_MONTHLY", destination: "SPENDING_ACCOUNT", startDate: "2026-01-01" },
    { key: "s_rrsp", person: "SELIA", name: "RRSP (payroll)", amount: 150, frequency: "SEMI_MONTHLY", destination: "RRSP", accountKey: "s_rrsp_grp", startDate: "2026-01-01" },
    { key: "cc", person: null, name: "Child-care payment", amount: 350, frequency: "MONTHLY", destination: "DEBT_PAYDOWN", startDate: "2026-01-01" },
  ],
  expenses: [
    { name: "Daycare", category: "Child care", amount: 900, frequency: "MONTHLY", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "Hydro + heating", category: "Utilities", amount: 320, frequency: "MONTHLY", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "Municipal taxes", category: "Property taxes", amount: 3_400, frequency: "ANNUAL", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "School taxes", category: "Property taxes", amount: 600, frequency: "ANNUAL", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "Home + auto insurance", category: "Insurance", amount: 210, frequency: "MONTHLY", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "Gas", category: "Gas", amount: 260, frequency: "MONTHLY", type: "FIXED", essential: true, startDate: "2026-01-01" },
    { name: "Internet", category: "Internet", amount: 70, frequency: "MONTHLY", type: "FIXED", startDate: "2026-01-01" },
    { name: "Streaming", category: "Streaming services", amount: 45, frequency: "MONTHLY", type: "FIXED", startDate: "2026-01-01" },
    { name: "Vacation fund", category: "Vacation", amount: 3_000, frequency: "ANNUAL", type: "FIXED", startDate: "2026-01-01" },
    { name: "Groceries", category: "Groceries", amount: 550, frequency: "MONTHLY", type: "FLEXIBLE", essential: true, startDate: "2026-01-01" },
    { name: "Restaurants", category: "Restaurants & bars", amount: 180, frequency: "MONTHLY", type: "FLEXIBLE", startDate: "2026-01-01" },
    { name: "Delivery", category: "UberEats", amount: 120, frequency: "MONTHLY", type: "FLEXIBLE", startDate: "2026-01-01" },
    { name: "Shopping", category: "Shopping", amount: 150, frequency: "MONTHLY", type: "FLEXIBLE", startDate: "2026-01-01" },
    { name: "Entertainment", category: "Entertainment", amount: 80, frequency: "MONTHLY", type: "FLEXIBLE", startDate: "2026-01-01" },
    { name: "Diapers & kid stuff", category: "Child shopping", amount: 90, frequency: "MONTHLY", type: "FLEXIBLE", essential: true, startDate: "2026-01-01" },
  ],
  debts: [
    { key: "loc", name: "Line of credit", type: "LOC", balance: 32_000, asOf: AS_OF, ratePct: 6.45, rateSince: "2026-01-01", minimum: { type: "INTEREST_ONLY" }, priority: 20, includeInPayoff: true, includeInNetWorth: true },
    { key: "card_a", name: "Credit card — Alex", type: "CREDIT_CARD", balance: 2_800, asOf: AS_OF, ratePct: 19.99, rateSince: "2026-01-01", minimum: { type: "PERCENT_OF_BALANCE", pct: 5, floor: 10 }, priority: 10, includeInPayoff: true, includeInNetWorth: true },
    { key: "card_s", name: "Credit card — Sélia", type: "CREDIT_CARD", balance: 1_450, asOf: AS_OF, ratePct: 20.99, rateSince: "2026-01-01", minimum: { type: "PERCENT_OF_BALANCE", pct: 5, floor: 10 }, priority: 11, includeInPayoff: true, includeInNetWorth: true },
    { key: "mortgage", name: "Mortgage", type: "MORTGAGE", balance: 480_000, asOf: AS_OF, ratePct: 4.29, rateSince: "2025-06-01", minimum: { type: "FIXED", amount: 2_600 }, priority: 90, amortizationMonths: 300, renewalDate: "2030-06-01", includeInPayoff: false, includeInNetWorth: false },
    { key: "car", name: "Car loan", type: "CAR_LOAN", balance: 14_000, asOf: AS_OF, ratePct: 5.99, rateSince: "2024-03-01", minimum: { type: "FIXED", amount: 520 }, priority: 50, endDate: "2028-12-01", includeInPayoff: false, includeInNetWorth: true },
  ],
  lumpSumSchedules: [{ name: "Stock plan withdrawal", amount: 3_000, months: [4, 11], startDate: "2026-01-01", sourceIncomeKey: "a_stock" }],
  contributions: [],
  contributionRoom: [
    { person: "ALEX", accountType: "TFSA", room: 40_000, asOf: AS_OF },
    { person: "ALEX", accountType: "RRSP", room: 22_000, asOf: AS_OF },
    { person: "SELIA", accountType: "TFSA", room: 35_000, asOf: AS_OF },
    { person: "SELIA", accountType: "RRSP", room: 18_000, asOf: AS_OF },
  ],
  scenarios: [
    { name: "Baseline", description: "Current budget, all minimums, child-care payment, stock-plan withdrawals.", isBaseline: true, overrides: {} },
    { name: "+500 $/month", description: "Put 500 $ more on debt every month.", overrides: { extraMonthly: { cents: 50_000 } } },
    { name: "LOC first", description: "Same as baseline, LOC before the cards.", overrides: { strategy: "LOC_FIRST" } },
  ],
  bonuses: [
    { person: "ALEX", amount: 4_000, year: 2026, month: 12 },
    { person: "SELIA", amount: 2_000, year: 2026, month: 12 },
  ],
  snapshots: [
    {
      month: "2026-07-01",
      debts: [{ debtKey: "loc", balance: 33_100 }, { debtKey: "card_a", balance: 3_050 }, { debtKey: "card_s", balance: 1_600 }],
      accounts: [{ accountKey: "a_rrsp_ind", balance: 41_200 }, { accountKey: "a_tfsa", balance: 6_600 }],
      spend: [{ category: "Groceries", amount: 590 }, { category: "Restaurants & bars", amount: 240 }, { category: "UberEats", amount: 150 }],
    },
    {
      month: "2026-08-01",
      debts: [{ debtKey: "loc", balance: 32_600 }, { debtKey: "card_a", balance: 2_900 }, { debtKey: "card_s", balance: 1_500 }],
      accounts: [{ accountKey: "a_rrsp_ind", balance: 42_000 }, { accountKey: "a_tfsa", balance: 6_750 }],
      spend: [{ category: "Groceries", amount: 560 }, { category: "Restaurants & bars", amount: 210 }, { category: "UberEats", amount: 130 }],
    },
  ],
};
