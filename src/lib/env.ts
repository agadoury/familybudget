/** Resolve the database URL from whatever the host injected (Vercel Storage / Neon / legacy Vercel Postgres). */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || undefined;
}

/**
 * Names of required settings that are missing. Only the database is truly required:
 * the session secret is derived from it and the password is chosen in the app.
 */
export function missingEnv(): string[] {
  return databaseUrl() ? [] : ["DATABASE_URL"];
}
