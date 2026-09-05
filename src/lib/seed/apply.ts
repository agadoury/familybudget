import type { Prisma, PrismaClient } from "@prisma/client";
import type { SeedData } from "./types";

const c = (dollars: number) => Math.round(dollars * 100);
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const bps = (pct: number) => Math.round(pct * 100);

/** Wipes every table and inserts the given data set. */
export async function applySeed(prisma: PrismaClient, data: SeedData) {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.snapshot.deleteMany(),
    prisma.bonus.deleteMany(),
    prisma.scenario.deleteMany(),
    prisma.contributionRoom.deleteMany(),
    prisma.contribution.deleteMany(),
    prisma.lumpSumSchedule.deleteMany(),
    prisma.debtPayment.deleteMany(),
    prisma.debtRate.deleteMany(),
    prisma.debt.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.income.deleteMany(),
    prisma.investmentAccount.deleteMany(),
    prisma.settings.deleteMany(),
  ]);

  await prisma.settings.create({
    data: {
      id: 1,
      alexName: data.settings.alexName,
      seliaName: data.settings.seliaName,
      homeValueCents: c(data.settings.homeValue),
      cashBufferCents: c(data.settings.cashBuffer),
      defaultReturnBps: bps(data.settings.defaultReturnPct),
    },
  });

  const accountIds = new Map<string, string>();
  // parents first
  const ordered = [...data.accounts.filter((a) => !a.parentKey), ...data.accounts.filter((a) => a.parentKey)];
  for (const a of ordered) {
    const row = await prisma.investmentAccount.create({
      data: {
        owner: a.owner,
        name: a.name,
        type: a.type,
        subType: a.subType,
        parentId: a.parentKey ? accountIds.get(a.parentKey) : undefined,
        balanceCents: c(a.balance),
        balanceAsOf: d(a.asOf),
        returnBps: bps(a.returnPct ?? (a.type === "CASH" ? 0 : data.settings.defaultReturnPct)),
        includeInNetWorth: a.includeInNetWorth ?? true,
        notes: a.notes,
      },
    });
    accountIds.set(a.key, row.id);
  }

  const incomeIds = new Map<string, string>();
  for (const i of data.incomes) {
    const accountId = i.accountKey ? accountIds.get(i.accountKey) : undefined;
    const row = await prisma.income.create({
      data: {
        person: i.person,
        name: i.name,
        amountCents: c(i.amount),
        frequency: i.frequency,
        destination: i.destination,
        investmentAccountId: accountId,
        startDate: d(i.startDate),
        notes: i.notes,
      },
    });
    incomeIds.set(i.key, row.id);
    // Payroll contributions are auto-created from RRSP / TFSA income lines.
    if (accountId && (i.destination === "RRSP" || i.destination === "TFSA")) {
      await prisma.contribution.create({
        data: {
          accountId,
          amountCents: c(i.amount),
          frequency: i.frequency,
          source: "PAYROLL",
          startDate: d(i.startDate),
          incomeId: row.id,
          notes: "Auto-created from payroll income line",
        },
      });
    }
  }

  for (const e of data.expenses) {
    await prisma.expense.create({
      data: {
        name: e.name,
        category: e.category,
        amountCents: c(e.amount),
        frequency: e.frequency,
        type: e.type,
        owner: e.owner ?? "SHARED",
        essential: e.essential ?? false,
        startDate: d(e.startDate),
        notes: e.notes,
      },
    });
  }

  const debtIds = new Map<string, string>();
  for (const x of data.debts) {
    const row = await prisma.debt.create({
      data: {
        name: x.name,
        type: x.type,
        balanceCents: c(x.balance),
        balanceAsOf: d(x.asOf),
        priority: x.priority,
        minimumType: x.minimum.type,
        minimumCents: x.minimum.type === "FIXED" ? c(x.minimum.amount) : 0,
        minimumBps: x.minimum.type === "PERCENT_OF_BALANCE" ? bps(x.minimum.pct) : 0,
        minimumFloorCents: x.minimum.type === "PERCENT_OF_BALANCE" ? c(x.minimum.floor) : 0,
        endDate: x.endDate ? d(x.endDate) : undefined,
        amortizationMonths: x.amortizationMonths,
        renewalDate: x.renewalDate ? d(x.renewalDate) : undefined,
        includeInPayoff: x.includeInPayoff,
        includeInNetWorth: x.includeInNetWorth,
        notes: x.notes,
        rates: { create: [{ effectiveDate: d(x.rateSince), annualRateBps: bps(x.ratePct) }] },
      },
    });
    debtIds.set(x.key, row.id);
  }

  for (const s of data.lumpSumSchedules) {
    await prisma.lumpSumSchedule.create({
      data: {
        name: s.name,
        amountCents: c(s.amount),
        months: s.months,
        startDate: d(s.startDate),
        sourceIncomeId: s.sourceIncomeKey ? incomeIds.get(s.sourceIncomeKey) : undefined,
        notes: s.notes,
      },
    });
  }

  for (const k of data.contributions) {
    await prisma.contribution.create({
      data: {
        accountId: accountIds.get(k.accountKey)!,
        amountCents: c(k.amount),
        frequency: k.frequency,
        source: k.source,
        startDate: d(k.startDate),
        notes: k.notes,
      },
    });
  }

  for (const r of data.contributionRoom) {
    await prisma.contributionRoom.create({
      data: { person: r.person, accountType: r.accountType, roomCents: c(r.room), asOf: d(r.asOf), notes: r.notes },
    });
  }

  let baselineId: string | null = null;
  for (const s of data.scenarios) {
    const row = await prisma.scenario.create({
      data: { name: s.name, description: s.description, isBaseline: s.isBaseline ?? false, overrides: s.overrides as Prisma.InputJsonValue },
    });
    if (s.isBaseline) baselineId = row.id;
  }
  if (baselineId) await prisma.settings.update({ where: { id: 1 }, data: { defaultScenarioId: baselineId } });

  for (const b of data.bonuses) {
    await prisma.bonus.create({
      data: { person: b.person, amountCents: c(b.amount), expectedYear: b.year, expectedMonth: b.month },
    });
  }

  for (const s of data.snapshots ?? []) {
    await prisma.snapshot.create({
      data: {
        month: d(s.month),
        note: s.note,
        debts: { create: s.debts.map((x) => ({ debtId: debtIds.get(x.debtKey)!, balanceCents: c(x.balance) })) },
        accounts: { create: s.accounts.map((x) => ({ accountId: accountIds.get(x.accountKey)!, balanceCents: c(x.balance) })) },
        spend: { create: s.spend.map((x) => ({ category: x.category, amountCents: c(x.amount) })) },
      },
    });
  }
}
