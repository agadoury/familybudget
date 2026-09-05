"use server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { audit, parse, safe, type ActionResult } from "./common";
import { bonusSchema, scenarioSchema } from "@/lib/schemas";
import { scenarioOverridesSchema } from "@/lib/payoff";
import type { z } from "zod";

export async function saveScenario(id: string | null, input: z.infer<typeof scenarioSchema>): Promise<ActionResult<{ id: string }>> {
  const p = parse(scenarioSchema, input);
  if (!p.ok) return p;
  const o = scenarioOverridesSchema.safeParse(p.data.overrides ?? {});
  if (!o.success) return { ok: false, error: `overrides: ${o.error.issues[0]?.message}` };
  const overrides = o.data as unknown as Prisma.InputJsonValue;
  return safe(async () => {
    if (id) {
      const before = await prisma.scenario.findUniqueOrThrow({ where: { id } });
      const editedBy = await audit("Scenario", id, "update", before, p.data);
      await prisma.scenario.update({ where: { id }, data: { name: p.data.name, description: p.data.description, overrides, updatedBy: editedBy } });
      return { id };
    }
    const editedBy = await audit("Scenario", "new", "create", null, p.data);
    const row = await prisma.scenario.create({ data: { name: p.data.name, description: p.data.description, overrides, createdBy: editedBy } });
    return { id: row.id };
  });
}

export async function duplicateScenario(id: string): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    const src = await prisma.scenario.findUniqueOrThrow({ where: { id } });
    const editedBy = await audit("Scenario", id, "create", null, { duplicateOf: id });
    const row = await prisma.scenario.create({
      data: { name: `${src.name} (copy)`, description: src.description, overrides: src.overrides as Prisma.InputJsonValue, createdBy: editedBy },
    });
    return { id: row.id };
  });
}

export async function deleteScenario(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.scenario.findUniqueOrThrow({ where: { id } });
    if (before.isBaseline) throw new Error("The baseline cannot be deleted.");
    await audit("Scenario", id, "delete", before, null);
    await prisma.scenario.delete({ where: { id } });
    return undefined;
  });
}

export async function upsertBonus(id: string | null, input: z.infer<typeof bonusSchema>): Promise<ActionResult<{ id: string }>> {
  const p = parse(bonusSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    if (id) {
      const before = await prisma.bonus.findUniqueOrThrow({ where: { id } });
      const editedBy = await audit("Bonus", id, "update", before, p.data);
      await prisma.bonus.update({ where: { id }, data: { ...p.data, updatedBy: editedBy } });
      return { id };
    }
    const editedBy = await audit("Bonus", "new", "create", null, p.data);
    const row = await prisma.bonus.create({ data: { ...p.data, updatedBy: editedBy } });
    return { id: row.id };
  });
}

/** Flip a bonus to confirmed: creates a real lump-sum DebtPayment on the given debt and re-anchors the balance. */
export async function confirmBonus(id: string, debtId: string, receivedDate: string, amountCents?: number): Promise<ActionResult> {
  return safe(async () => {
    const bonus = await prisma.bonus.findUniqueOrThrow({ where: { id } });
    if (bonus.debtPaymentId) throw new Error("Already confirmed.");
    const amount = Math.round(((amountCents ?? bonus.amountCents) * bonus.pctAppliedBps) / 10_000);
    const editedBy = await audit("Bonus", id, "update", bonus, { confirmed: true, debtId, amount });
    const date = new Date(`${receivedDate}T00:00:00.000Z`);
    await prisma.$transaction(async (tx) => {
      const payment = await tx.debtPayment.create({
        data: { debtId, date, amountCents: amount, type: "LUMP_SUM", note: `${bonus.person} bonus`, createdBy: editedBy },
      });
      await tx.debt.update({ where: { id: debtId }, data: { balanceCents: { decrement: amount }, balanceAsOf: date } });
      await tx.bonus.update({ where: { id }, data: { confidence: "CONFIRMED", debtPaymentId: payment.id, amountCents: amountCents ?? bonus.amountCents } });
    });
    return undefined;
  });
}
