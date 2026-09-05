"use server";
import { prisma } from "@/lib/db/prisma";
import { audit, d, parse, safe, type ActionResult } from "./common";
import { debtPaymentSchema, debtRateSchema, debtSchema, lumpSumScheduleSchema, type DebtInputForm } from "@/lib/schemas";
import type { z } from "zod";

export async function createDebt(input: DebtInputForm): Promise<ActionResult<{ id: string }>> {
  const p = parse(debtSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("Debt", "new", "create", null, p.data);
    const { annualRateBps, rateEffectiveDate, balanceAsOf, endDate, renewalDate, ...rest } = p.data;
    const row = await prisma.debt.create({
      data: {
        ...rest,
        balanceAsOf: d(balanceAsOf)!,
        endDate: d(endDate),
        renewalDate: d(renewalDate),
        updatedBy: editedBy,
        rates: { create: [{ effectiveDate: d(rateEffectiveDate ?? balanceAsOf)!, annualRateBps }] },
      },
    });
    return { id: row.id };
  });
}

export async function updateDebt(id: string, input: Partial<DebtInputForm>): Promise<ActionResult> {
  const p = parse(debtSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.debt.findUniqueOrThrow({ where: { id }, include: { rates: { orderBy: { effectiveDate: "desc" }, take: 1 } } });
    const editedBy = await audit("Debt", id, "update", before, p.data);
    const { annualRateBps, rateEffectiveDate, balanceAsOf, endDate, renewalDate, ...rest } = p.data;
    await prisma.debt.update({
      where: { id },
      data: {
        ...rest,
        ...(balanceAsOf ? { balanceAsOf: d(balanceAsOf)! } : {}),
        ...(endDate !== undefined ? { endDate: d(endDate) } : {}),
        ...(renewalDate !== undefined ? { renewalDate: d(renewalDate) } : {}),
        updatedBy: editedBy,
      },
    });
    // A changed current rate becomes a dated rate row (today unless a date was given).
    if (annualRateBps !== undefined && annualRateBps !== before.rates[0]?.annualRateBps) {
      const eff = d(rateEffectiveDate ?? new Date().toISOString().slice(0, 10))!;
      await prisma.debtRate.upsert({
        where: { id: `${id}-${eff.toISOString().slice(0, 10)}` },
        update: { annualRateBps },
        create: { id: `${id}-${eff.toISOString().slice(0, 10)}`, debtId: id, effectiveDate: eff, annualRateBps },
      });
    }
    return undefined;
  });
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.debt.findUniqueOrThrow({ where: { id } });
    await audit("Debt", id, "delete", before, null);
    await prisma.debt.delete({ where: { id } });
    return undefined;
  });
}

export async function addDebtRate(input: z.infer<typeof debtRateSchema>): Promise<ActionResult> {
  const p = parse(debtRateSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    await audit("DebtRate", p.data.debtId, "create", null, p.data);
    await prisma.debtRate.create({ data: { ...p.data, effectiveDate: d(p.data.effectiveDate)! } });
    return undefined;
  });
}

export async function deleteDebtRate(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.debtRate.findUniqueOrThrow({ where: { id } });
    const count = await prisma.debtRate.count({ where: { debtId: before.debtId } });
    if (count <= 1) throw new Error("A debt needs at least one rate.");
    await audit("DebtRate", id, "delete", before, null);
    await prisma.debtRate.delete({ where: { id } });
    return undefined;
  });
}

/** Log a payment and reduce the balance accordingly (balance history is derived from payments). */
export async function addDebtPayment(input: z.infer<typeof debtPaymentSchema>): Promise<ActionResult> {
  const p = parse(debtPaymentSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("DebtPayment", p.data.debtId, "create", null, p.data);
    await prisma.$transaction([
      prisma.debtPayment.create({ data: { ...p.data, date: d(p.data.date)!, createdBy: editedBy } }),
      prisma.debt.update({
        where: { id: p.data.debtId },
        data: { balanceCents: { decrement: p.data.amountCents }, balanceAsOf: d(p.data.date)!, updatedBy: editedBy },
      }),
    ]);
    const debt = await prisma.debt.findUniqueOrThrow({ where: { id: p.data.debtId } });
    if (debt.balanceCents < 0) await prisma.debt.update({ where: { id: debt.id }, data: { balanceCents: 0 } });
    return undefined;
  });
}

export async function upsertLumpSumSchedule(id: string | null, input: z.infer<typeof lumpSumScheduleSchema>): Promise<ActionResult> {
  const p = parse(lumpSumScheduleSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const data = { ...p.data, startDate: d(p.data.startDate)!, endDate: d(p.data.endDate) };
    if (id) {
      const before = await prisma.lumpSumSchedule.findUniqueOrThrow({ where: { id } });
      const editedBy = await audit("LumpSumSchedule", id, "update", before, p.data);
      await prisma.lumpSumSchedule.update({ where: { id }, data: { ...data, updatedBy: editedBy } });
    } else {
      const editedBy = await audit("LumpSumSchedule", "new", "create", null, p.data);
      await prisma.lumpSumSchedule.create({ data: { ...data, updatedBy: editedBy } });
    }
    return undefined;
  });
}

export async function deleteLumpSumSchedule(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.lumpSumSchedule.findUniqueOrThrow({ where: { id } });
    await audit("LumpSumSchedule", id, "delete", before, null);
    await prisma.lumpSumSchedule.delete({ where: { id } });
    return undefined;
  });
}
