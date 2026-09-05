"use server";
import { prisma } from "@/lib/db/prisma";
import { parseCsv } from "@/lib/csv";
import { audit, d, safe, type ActionResult } from "./common";
import { contributionSchema, expenseSchema, incomeSchema } from "@/lib/schemas";
import { parseMoney } from "@/lib/money";

/**
 * Import the budget CSV produced by the export. Rows with a known id are updated, rows
 * without an id are created; nothing is deleted. Amount is in dollars.
 */
export async function importBudgetCsv(text: string): Promise<ActionResult<{ created: number; updated: number }>> {
  return safe(async () => {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("Empty CSV");
    const header = rows[0].map((h) => h.trim());
    const idx = (k: string) => header.indexOf(k);
    for (const k of ["kind", "name", "amount", "frequency"]) if (idx(k) < 0) throw new Error(`Missing column: ${k}`);
    const accounts = await prisma.investmentAccount.findMany();
    let created = 0;
    let updated = 0;
    const editedBy = await audit("Budget", "csv", "update", null, { rows: rows.length - 1 });
    for (const r of rows.slice(1)) {
      const g = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "").trim() : "");
      const kind = g("kind").toLowerCase();
      const id = g("id");
      const amountCents = parseMoney(g("amount"));
      if (amountCents === null) throw new Error(`Bad amount for "${g("name")}"`);
      const startDate = g("startDate") || new Date().toISOString().slice(0, 10);
      const endDate = g("endDate") || null;
      const notes = g("notes") || null;
      if (kind === "income") {
        const personRaw = g("person_or_owner").toUpperCase();
        const data = incomeSchema.parse({
          person: personRaw === "ALEX" || personRaw === "SELIA" ? personRaw : null,
          name: g("name"),
          amountCents,
          frequency: g("frequency").toUpperCase(),
          destination: (g("type_or_destination") || "SPENDING_ACCOUNT").toUpperCase(),
          startDate,
          endDate,
          notes,
          investmentAccountId: accounts.find((a) => a.name === g("account"))?.id ?? null,
        });
        const row = { ...data, startDate: d(data.startDate)!, endDate: d(data.endDate), updatedBy: editedBy };
        if (id && (await prisma.income.findUnique({ where: { id } }))) {
          await prisma.income.update({ where: { id }, data: row });
          updated++;
        } else {
          await prisma.income.create({ data: row });
          created++;
        }
      } else if (kind === "expense") {
        const data = expenseSchema.parse({
          name: g("name"),
          category: g("category") || "Misc",
          amountCents,
          frequency: g("frequency").toUpperCase(),
          type: (g("type_or_destination") || "FIXED").toUpperCase(),
          owner: (g("person_or_owner") || "SHARED").toUpperCase(),
          essential: ["true", "1", "yes", "oui"].includes(g("essential").toLowerCase()),
          startDate,
          endDate,
          notes,
        });
        const row = { ...data, startDate: d(data.startDate)!, endDate: d(data.endDate), updatedBy: editedBy };
        if (id && (await prisma.expense.findUnique({ where: { id } }))) {
          await prisma.expense.update({ where: { id }, data: row });
          updated++;
        } else {
          await prisma.expense.create({ data: row });
          created++;
        }
      } else if (kind === "contribution") {
        const account = accounts.find((a) => a.name === g("account"));
        if (!account) throw new Error(`Unknown account "${g("account")}" for contribution`);
        const data = contributionSchema.parse({
          accountId: account.id,
          amountCents,
          frequency: g("frequency").toUpperCase(),
          source: (g("type_or_destination") || "SPENDING_ACCOUNT").toUpperCase(),
          startDate,
          endDate,
          notes,
        });
        const row = { ...data, startDate: d(data.startDate)!, endDate: d(data.endDate), updatedBy: editedBy };
        const existing = id ? await prisma.contribution.findUnique({ where: { id } }) : null;
        if (existing?.incomeId) continue; // payroll lines are owned by their income line
        if (existing) {
          await prisma.contribution.update({ where: { id }, data: row });
          updated++;
        } else {
          await prisma.contribution.create({ data: row });
          created++;
        }
      } else {
        throw new Error(`Unknown kind "${kind}" (expected income, expense or contribution)`);
      }
    }
    return { created, updated };
  });
}
