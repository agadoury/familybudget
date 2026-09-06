import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { decryptJson, type EncryptedBundle } from "./crypto";
import type { SeedData } from "./types";

/** The encrypted household bundle shipped in the repo, or null when none exists. */
export function loadHouseholdBundle(): EncryptedBundle | null {
  const p = path.join(process.cwd(), "prisma", "household.enc.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as EncryptedBundle;
  } catch {
    return null;
  }
}

export function hasHouseholdBundle(): boolean {
  return loadHouseholdBundle() !== null;
}

/** Decrypt the household numbers with the passphrase; null when wrong. */
export function unlockHouseholdSeed(passphrase: string): SeedData | null {
  const b = loadHouseholdBundle();
  return b ? decryptJson<SeedData>(b, passphrase) : null;
}
