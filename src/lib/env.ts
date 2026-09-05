/** Resolve the database URL from whatever the host injected (Vercel Storage / Neon / legacy Vercel Postgres). */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || undefined;
}

/** Names of required settings that are missing, for the setup page. */
export function missingEnv(): string[] {
  const out: string[] = [];
  if (!databaseUrl()) out.push("DATABASE_URL");
  if (!process.env.HOUSEHOLD_PASSWORD) out.push("HOUSEHOLD_PASSWORD");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) out.push("SESSION_SECRET");
  return out;
}
