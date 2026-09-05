import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { currentEditor } from "@/lib/auth";
import type { ZodType } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const PAGES = ["/", "/budget", "/payoff", "/insights", "/investments", "/checkin", "/settings"];

export function revalidateAll() {
  for (const p of PAGES) revalidatePath(p);
}

export function parse<T>(schema: ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: `${first.path.join(".") || "input"}: ${first.message}` };
}

export async function audit(entity: string, entityId: string, action: "create" | "update" | "delete", before: unknown, after: unknown) {
  const editedBy = await currentEditor();
  await prisma.auditLog.create({
    data: {
      entity,
      entityId,
      action,
      editedBy,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  return editedBy;
}

export const d = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

export async function safe<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}
