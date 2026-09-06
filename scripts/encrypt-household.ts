/**
 * Encrypt prisma/seed.household.ts (gitignored) into prisma/household.enc.json (committed).
 * Usage: HOUSEHOLD_PASSPHRASE="..." npx tsx scripts/encrypt-household.ts
 */
import { writeFileSync } from "node:fs";
import { encryptJson } from "../src/lib/seed/crypto";

async function main() {
  const passphrase = process.env.HOUSEHOLD_PASSPHRASE;
  if (!passphrase || passphrase.length < 12) throw new Error("Set HOUSEHOLD_PASSPHRASE (12+ characters)");
  const file = "../prisma/seed." + "household";
  const { householdSeed } = (await import(file)) as { householdSeed: unknown };
  const bundle = encryptJson(householdSeed, passphrase);
  writeFileSync("prisma/household.enc.json", JSON.stringify(bundle, null, 2) + "\n");
  console.log("Wrote prisma/household.enc.json");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
