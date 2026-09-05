import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { CSV_HEADER, toCsv } from "@/lib/csv";
import { iso } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const [incomes, expenses, contributions] = await Promise.all([
    prisma.income.findMany({ include: { investmentAccount: true }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({ orderBy: [{ type: "asc" }, { category: "asc" }] }),
    prisma.contribution.findMany({ include: { account: true } }),
  ]);
  const $ = (c: number) => (c / 100).toFixed(2);
  const rows: (string | number | boolean | null)[][] = [CSV_HEADER];
  for (const i of incomes) rows.push(["income", i.id, i.person ?? "", i.name, "", $(i.amountCents), i.frequency, i.destination, "", i.investmentAccount?.name ?? "", iso(i.startDate), iso(i.endDate), i.notes]);
  for (const e of expenses) rows.push(["expense", e.id, e.owner, e.name, e.category, $(e.amountCents), e.frequency, e.type, e.essential, "", iso(e.startDate), iso(e.endDate), e.notes]);
  for (const c of contributions) rows.push(["contribution", c.id, "", c.incomeId ? "payroll (read-only)" : "", "", $(c.amountCents), c.frequency, c.source, "", c.account.name, iso(c.startDate), iso(c.endDate), c.notes]);
  const body = "﻿" + toCsv(rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budget-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
