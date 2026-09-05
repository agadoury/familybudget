import { cache } from "react";
import { prisma } from "./prisma";
import type { HouseholdData } from "@/lib/projection";
import { parseOverrides, type ScenarioOverrides } from "@/lib/payoff";

/** Everything the engines need, loaded once per request. */
export const loadHousehold = cache(async (): Promise<HouseholdData & { settingsRow: Awaited<ReturnType<typeof getSettings>> }> => {
  const [settingsRow, incomes, expenses, contributions, debts, lumpSumSchedules, accounts, bonuses] = await Promise.all([
    getSettings(),
    prisma.income.findMany({ orderBy: [{ person: "asc" }, { name: "asc" }] }),
    prisma.expense.findMany({ orderBy: [{ type: "asc" }, { category: "asc" }, { name: "asc" }] }),
    prisma.contribution.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.debt.findMany({ include: { rates: { orderBy: { effectiveDate: "asc" } } }, orderBy: { priority: "asc" } }),
    prisma.lumpSumSchedule.findMany(),
    prisma.investmentAccount.findMany({ orderBy: [{ owner: "asc" }, { type: "asc" }, { name: "asc" }] }),
    prisma.bonus.findMany({ orderBy: { person: "asc" } }),
  ]);
  return {
    settingsRow,
    incomes,
    expenses,
    contributions,
    debts,
    lumpSumSchedules,
    accounts,
    bonuses,
    settings: {
      defaultReturnBps: settingsRow.defaultReturnBps,
      homeValueCents: settingsRow.homeValueCents,
      cashBufferCents: settingsRow.cashBufferCents,
    },
  };
});

export const getSettings = cache(async () => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (s) return s;
  return prisma.settings.create({ data: { id: 1 } });
});

export const loadScenarios = cache(async () => {
  const rows = await prisma.scenario.findMany({ orderBy: [{ isBaseline: "desc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({ ...r, overrides: parseOverrides(r.overrides) as ScenarioOverrides }));
});

export const loadBaselineOverrides = cache(async (): Promise<ScenarioOverrides> => {
  const s = await prisma.scenario.findFirst({ where: { isBaseline: true } });
  return parseOverrides(s?.overrides);
});

export const loadSnapshots = cache(async () =>
  prisma.snapshot.findMany({
    include: { debts: true, accounts: true, spend: true },
    orderBy: { month: "asc" },
  }),
);
