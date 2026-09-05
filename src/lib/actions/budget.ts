"use server";
import { prisma } from "@/lib/db/prisma";
import { audit, d, parse, safe, type ActionResult } from "./common";
import { contributionSchema, expenseSchema, incomeSchema, type ContributionInput, type ExpenseInput, type IncomeInput } from "@/lib/schemas";

// ---------- Incomes ----------
export async function createIncome(input: IncomeInput): Promise<ActionResult<{ id: string }>> {
  const p = parse(incomeSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("Income", "new", "create", null, p.data);
    const row = await prisma.income.create({
      data: { ...p.data, startDate: d(p.data.startDate)!, endDate: d(p.data.endDate), updatedBy: editedBy },
    });
    await syncPayrollContribution(row.id);
    return { id: row.id };
  });
}

export async function updateIncome(id: string, input: Partial<IncomeInput>): Promise<ActionResult> {
  const p = parse(incomeSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.income.findUniqueOrThrow({ where: { id } });
    const editedBy = await audit("Income", id, "update", before, p.data);
    const { startDate, endDate, ...rest } = p.data;
    await prisma.income.update({
      where: { id },
      data: { ...rest, ...(startDate ? { startDate: d(startDate)! } : {}), ...(endDate !== undefined ? { endDate: d(endDate) } : {}), updatedBy: editedBy },
    });
    await syncPayrollContribution(id);
    return undefined;
  });
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.income.findUniqueOrThrow({ where: { id } });
    await audit("Income", id, "delete", before, null);
    await prisma.income.delete({ where: { id } });
    return undefined;
  });
}

/** Payroll RRSP/TFSA income lines own a Contribution row; keep it in sync (or remove it). */
async function syncPayrollContribution(incomeId: string) {
  const income = await prisma.income.findUnique({ where: { id: incomeId } });
  if (!income) return;
  const wantsContribution = income.investmentAccountId && (income.destination === "RRSP" || income.destination === "TFSA");
  const existing = await prisma.contribution.findUnique({ where: { incomeId } });
  if (!wantsContribution) {
    if (existing) await prisma.contribution.delete({ where: { id: existing.id } });
    return;
  }
  const data = {
    accountId: income.investmentAccountId!,
    amountCents: income.amountCents,
    frequency: income.frequency,
    source: "PAYROLL" as const,
    startDate: income.startDate,
    endDate: income.endDate,
    incomeId,
    notes: "Auto-created from payroll income line",
  };
  if (existing) await prisma.contribution.update({ where: { id: existing.id }, data });
  else await prisma.contribution.create({ data });
}

// ---------- Expenses ----------
export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const p = parse(expenseSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("Expense", "new", "create", null, p.data);
    const row = await prisma.expense.create({
      data: { ...p.data, startDate: d(p.data.startDate)!, endDate: d(p.data.endDate), updatedBy: editedBy },
    });
    return { id: row.id };
  });
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>): Promise<ActionResult> {
  const p = parse(expenseSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.expense.findUniqueOrThrow({ where: { id } });
    const editedBy = await audit("Expense", id, "update", before, p.data);
    const { startDate, endDate, ...rest } = p.data;
    await prisma.expense.update({
      where: { id },
      data: { ...rest, ...(startDate ? { startDate: d(startDate)! } : {}), ...(endDate !== undefined ? { endDate: d(endDate) } : {}), updatedBy: editedBy },
    });
    return undefined;
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.expense.findUniqueOrThrow({ where: { id } });
    await audit("Expense", id, "delete", before, null);
    await prisma.expense.delete({ where: { id } });
    return undefined;
  });
}

// ---------- Contributions (savings & investments lines) ----------
export async function createContribution(input: ContributionInput): Promise<ActionResult<{ id: string }>> {
  const p = parse(contributionSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("Contribution", "new", "create", null, p.data);
    const row = await prisma.contribution.create({
      data: { ...p.data, startDate: d(p.data.startDate)!, endDate: d(p.data.endDate), updatedBy: editedBy },
    });
    return { id: row.id };
  });
}

export async function updateContribution(id: string, input: Partial<ContributionInput>): Promise<ActionResult> {
  const p = parse(contributionSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.contribution.findUniqueOrThrow({ where: { id } });
    if (before.incomeId) throw new Error("This line is a payroll deduction: edit the income line instead.");
    const editedBy = await audit("Contribution", id, "update", before, p.data);
    const { startDate, endDate, ...rest } = p.data;
    await prisma.contribution.update({
      where: { id },
      data: { ...rest, ...(startDate ? { startDate: d(startDate)! } : {}), ...(endDate !== undefined ? { endDate: d(endDate) } : {}), updatedBy: editedBy },
    });
    return undefined;
  });
}

export async function deleteContribution(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.contribution.findUniqueOrThrow({ where: { id } });
    if (before.incomeId) throw new Error("This line is a payroll deduction: delete the income line instead.");
    await audit("Contribution", id, "delete", before, null);
    await prisma.contribution.delete({ where: { id } });
    return undefined;
  });
}
