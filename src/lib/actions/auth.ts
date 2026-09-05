"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, EDITOR_COOKIE, SESSION_COOKIE, sessionToken, type Editor } from "@/lib/auth";

const YEAR = 60 * 60 * 24 * 365;

export async function login(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ password: z.string().min(1), next: z.string().optional() }).safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter the household password." };
  if (!checkPassword(parsed.data.password)) return { error: "Wrong password." };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";
  redirect(next);
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
