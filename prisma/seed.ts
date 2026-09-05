import { PrismaClient } from "@prisma/client";
import { applySeed } from "../src/lib/seed/apply";
import { demoSeed } from "../src/lib/seed/demo";
import type { SeedData } from "../src/lib/seed/types";

const prisma = new PrismaClient();

async function main() {
  const profile = process.env.SEED_PROFILE ?? "demo";
  let data: SeedData = demoSeed;
  if (profile === "household") {
    try {
      // Dynamic import: the file is gitignored and may not exist.
      const mod = (await import("./seed.household")) as { householdSeed: SeedData };
      data = mod.householdSeed;
      console.log("Seeding REAL household data from prisma/seed.household.ts");
    } catch (e) {
      console.error("SEED_PROFILE=household but prisma/seed.household.ts is missing. Copy seed.household.example.ts first.");
      throw e;
    }
  } else {
    console.log("Seeding demo data");
  }
  await applySeed(prisma, data);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
