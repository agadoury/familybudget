"use server";
import { prisma } from "@/lib/db/prisma";
import { audit, parse, safe, type ActionResult } from "./common";
import { snapshotSchema, type SnapshotInput } from "@/lib/schemas";
import { monthKeyToDate } from "@/lib/frequency";

/**
 * Monthly check-in: records actual balances and spend, re-anchors debts and accounts to the
 * entered balances, logs lump sums for the record (the entered balance is authoritative),
 * and stores the projected payoff / net worth passed by the client for later drift comparison.
 */
export async function saveCheckin(input: SnapshotInput & { projectedPayoffMonth: string | null; projectedInterestCents: number; netWorthCents: number }): Promise<ActionResult<{ id: string }>> {
  const p = parse(snapshotSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("Snapshot", p.data.month, "update", null, p.data);
    const month = monthKeyToDate(p.data.month);
    const asOf = new Date();
    const id = await prisma.$transaction(async (tx) => {
      const existing = await tx.snapshot.findUnique({ where: { month } });
      if (existing) await tx.snapshot.delete({ where: { id: existing.id } });
      const snap = await tx.snapshot.create({
        data: {
          month,
          note: p.data.note,
          projectedPayoffMonth: input.projectedPayoffMonth ? monthKeyToDate(input.projectedPayoffMonth) : null,
          projectedInterestCents: input.projectedInterestCents,
          netWorthCents: input.netWorthCents,
          createdBy: editedBy,
          debts: { create: p.data.debts.map((d) => ({ debtId: d.debtId, balanceCents: d.balanceCents })) },
          accounts: { create: p.data.accounts.map((a) => ({ accountId: a.accountId, balanceCents: a.balanceCents })) },
          spend: { create: p.data.spend.map((s) => ({ category: s.category, amountCents: s.amountCents })) },
        },
      });
      for (const d of p.data.debts) await tx.debt.update({ where: { id: d.debtId }, data: { balanceCents: d.balanceCents, balanceAsOf: asOf, updatedBy: editedBy } });
      for (const a of p.data.accounts) await tx.investmentAccount.update({ where: { id: a.accountId }, data: { balanceCents: a.balanceCents, balanceAsOf: asOf, updatedBy: editedBy } });
      for (const l of p.data.lumpSums) {
        if (l.amountCents <= 0) continue;
        const payment = await tx.debtPayment.create({ data: { debtId: l.debtId, date: asOf, amountCents: l.amountCents, type: "LUMP_SUM", note: l.note ?? "Check-in lump sum", createdBy: editedBy } });
        if (l.bonusId) await tx.bonus.update({ where: { id: l.bonusId }, data: { confidence: "CONFIRMED", debtPaymentId: payment.id, amountCents: l.amountCents } });
      }
      return snap.id;
    });
    return { id };
  });
}
