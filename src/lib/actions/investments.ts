"use server";
import { prisma } from "@/lib/db/prisma";
import { audit, d, parse, safe, type ActionResult } from "./common";
import { accountSchema, contributionRoomSchema, type AccountInput } from "@/lib/schemas";
import type { z } from "zod";

export async function createAccount(input: AccountInput): Promise<ActionResult<{ id: string }>> {
  const p = parse(accountSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("InvestmentAccount", "new", "create", null, p.data);
    const row = await prisma.investmentAccount.create({ data: { ...p.data, balanceAsOf: d(p.data.balanceAsOf)!, updatedBy: editedBy } });
    return { id: row.id };
  });
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<ActionResult> {
  const p = parse(accountSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.investmentAccount.findUniqueOrThrow({ where: { id } });
    const editedBy = await audit("InvestmentAccount", id, "update", before, p.data);
    const { balanceAsOf, ...rest } = p.data;
    // Editing the balance stamps the as-of date to today unless one was given.
    const asOf = balanceAsOf ? d(balanceAsOf)! : rest.balanceCents !== undefined ? new Date() : undefined;
    await prisma.investmentAccount.update({ where: { id }, data: { ...rest, ...(asOf ? { balanceAsOf: asOf } : {}), updatedBy: editedBy } });
    return undefined;
  });
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  return safe(async () => {
    const before = await prisma.investmentAccount.findUniqueOrThrow({ where: { id } });
    await audit("InvestmentAccount", id, "delete", before, null);
    await prisma.investmentAccount.delete({ where: { id } });
    return undefined;
  });
}

export async function upsertContributionRoom(input: z.infer<typeof contributionRoomSchema>): Promise<ActionResult> {
  const p = parse(contributionRoomSchema, input);
  if (!p.ok) return p;
  return safe(async () => {
    const editedBy = await audit("ContributionRoom", `${p.data.person}:${p.data.accountType}`, "update", null, p.data);
    await prisma.contributionRoom.upsert({
      where: { person_accountType: { person: p.data.person, accountType: p.data.accountType } },
      update: { roomCents: p.data.roomCents, asOf: d(p.data.asOf)!, notes: p.data.notes, updatedBy: editedBy },
      create: { ...p.data, asOf: d(p.data.asOf)!, updatedBy: editedBy },
    });
    return undefined;
  });
}
