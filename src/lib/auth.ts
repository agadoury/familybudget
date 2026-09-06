import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { databaseUrl } from "@/lib/env";
import { getSettings } from "@/lib/db/load";

export const SESSION_COOKIE = "hb_session";
export const EDITOR_COOKIE = "hb_editor";

/**
 * Cookie-signing secret. SESSION_SECRET if set; otherwise derived from the database URL,
 * which is itself a secret only the deployment knows. Either way it never leaves the server.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const db = databaseUrl();
  if (!db) throw new Error("No SESSION_SECRET and no DATABASE_URL to derive one from");
  return createHash("sha256").update(`household-budget:${db}`).digest("hex");
}

/** The password "source": the env var if set, otherwise the scrypt hash stored in Settings. */
async function passwordMaterial(): Promise<{ kind: "env"; value: string } | { kind: "db"; hash: string } | { kind: "none" }> {
  const env = process.env.HOUSEHOLD_PASSWORD;
  if (env) return { kind: "env", value: env };
  const s = await getSettings();
  if (s.passwordHash) return { kind: "db", hash: s.passwordHash };
  return { kind: "none" };
}

/** True when no password exists yet (first visit): the login page shows "create a password". */
export async function needsPasswordSetup(): Promise<boolean> {
  return (await passwordMaterial()).kind === "none";
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyHash(pw: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Session token = HMAC over the password material, so a password change signs everyone out. */
export async function sessionToken(): Promise<string> {
  const m = await passwordMaterial();
  const subject = m.kind === "env" ? `env:${m.value}` : m.kind === "db" ? `db:${m.hash}` : "none";
  return createHmac("sha256", secret()).update(`household:${subject}`).digest("hex");
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = Buffer.from(await sessionToken());
  const got = Buffer.from(token);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const m = await passwordMaterial();
  if (m.kind === "env") {
    const a = Buffer.from(m.value);
    const b = Buffer.from(candidate);
    return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  }
  if (m.kind === "db") return verifyHash(candidate, m.hash);
  return false;
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
