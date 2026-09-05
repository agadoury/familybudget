"use server";
import { prisma } from "@/lib/db/prisma";
import { audit, parse, safe, type ActionResult } from "./common";
import { settingsSchema } from "@/lib/schemas";
import { applySeed } from "@/lib/seed/apply";
import { demoSeed } from "@/lib/seed/demo";

export async function setLanguage(language: "EN" | "FR") {
  await prisma.settings.upsert({ where: { id: 1 }, update: { language }, create: { id: 1, language } });
}

export async function updateSettings(input: Partial<import("zod").infer<typeof settingsSchema>>): Promise<ActionResult> {
  const p = parse(settingsSchema.partial(), input);
  if (!p.ok) return p;
  return safe(async () => {
    const before = await prisma.settings.findUnique({ where: { id: 1 } });
    const editedBy = await audit("Settings", "1", "update", before, p.data);
    await prisma.settings.upsert({ where: { id: 1 }, update: { ...p.data, updatedBy: editedBy }, create: { id: 1, ...p.data } });
    return undefined;
  });
}

export async function resetDemoData(): Promise<ActionResult> {
  return safe(async () => {
    await applySeed(prisma, demoSeed);
    return undefined;
  });
}
