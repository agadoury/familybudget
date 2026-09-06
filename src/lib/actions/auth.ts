"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { checkPassword, EDITOR_COOKIE, hashPassword, needsPasswordSetup, SESSION_COOKIE, sessionToken, type Editor } from "@/lib/auth";
import { audit } from "./common";

const YEAR = 60 * 60 * 24 * 365;

async function setSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
}

export async function login(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ password: z.string().min(1), next: z.string().optional() }).safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter the household password." };
  if (!(await checkPassword(parsed.data.password))) return { error: "Wrong password." };
  await setSessionCookie();
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";
  redirect(next);
}

/** First visit only: choose the shared household password (stored as a scrypt hash). */
export async function createPassword(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  if (!(await needsPasswordSetup())) return { error: "A password already exists. Sign in instead." };
  const parsed = z
    .object({ password: z.string().min(8, "Use at least 8 characters."), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "The two passwords do not match.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  await prisma.settings.upsert({ where: { id: 1 }, update: { passwordHash: hashPassword(parsed.data.password) }, create: { id: 1, passwordHash: hashPassword(parsed.data.password) } });
  await setSessionCookie();
  redirect("/");
}

/** Change the household password from Settings (requires the current one). Signs everyone out. */
export async function changePassword(input: { current: string; next: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.HOUSEHOLD_PASSWORD) return { ok: false, error: "The password is set by the HOUSEHOLD_PASSWORD environment variable; change it there." };
  if (!(await checkPassword(input.current))) return { ok: false, error: "Current password is wrong." };
  if (input.next.length < 8) return { ok: false, error: "Use at least 8 characters." };
  await audit("Settings", "1", "update", null, { passwordChanged: true });
  await prisma.settings.update({ where: { id: 1 }, data: { passwordHash: hashPassword(input.next) } });
  await setSessionCookie();
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setEditor(editor: Editor) {
  const jar = await cookies();
  jar.set(EDITOR_COOKIE, editor, { sameSite: "lax", maxAge: YEAR * 5, path: "/" });
}
