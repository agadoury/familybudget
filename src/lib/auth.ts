import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "hb_session";
export const EDITOR_COOKIE = "hb_editor";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return s;
}

/** The session token is an HMAC of a fixed subject; it changes whenever the secret or password changes. */
export function sessionToken(): string {
  return createHmac("sha256", secret()).update(`household:${process.env.HOUSEHOLD_PASSWORD ?? ""}`).digest("hex");
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(sessionToken());
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function checkPassword(candidate: string): boolean {
  const pw = process.env.HOUSEHOLD_PASSWORD ?? "";
  const a = Buffer.from(pw);
  const b = Buffer.from(candidate);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export type Editor = "ALEX" | "SELIA";

export async function currentEditor(): Promise<Editor> {
  const jar = await cookies();
  return jar.get(EDITOR_COOKIE)?.value === "SELIA" ? "SELIA" : "ALEX";
}
