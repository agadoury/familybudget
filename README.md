# Household budget, LOC payoff & investment app

Private web app for two people: budget, consumer-debt payoff planning (LOC + credit cards), investment
projections, monthly check-in. Next.js 15 (App Router) + TypeScript + Tailwind, Prisma + Postgres, Recharts.
All money is stored as integer cents; rates as basis points. See `PLAN.md` for the model and `DECISIONS.md`
for trade-offs.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL / DIRECT_URL, HOUSEHOLD_PASSWORD, SESSION_SECRET
npm install
npx prisma migrate dev          # creates the schema
npm run db:seed                 # demo data
# or, with your real numbers in prisma/seed.household.ts (gitignored; copy seed.household.example.ts):
npm run db:seed:household
npm run dev                     # http://localhost:3000
npm test                        # payoff + investment engine unit tests
```

## Deploy (Vercel + Neon)

1. **Neon**: create a project; keep the default branch for production and create a `dev` branch for local
   work. Copy the *pooled* connection string into `DATABASE_URL` and the *direct* one into `DIRECT_URL`.
2. **Vercel**: import this repository. Environment variables:
   `DATABASE_URL`, `DIRECT_URL`, `HOUSEHOLD_PASSWORD`, `SESSION_SECRET` (32+ random chars).
   Build command: `prisma migrate deploy && next build` (or set `npm run vercel-build`).
3. Seed production once from your machine, pointing at the production branch:
   `DATABASE_URL=... DIRECT_URL=... SEED_PROFILE=household npx tsx prisma/seed.ts`
4. Open the URL on both phones and sign in with the household password. Choose who is editing in the
   sidebar (Alex / Sélia); every change is logged with that name.

No analytics, no third-party scripts, no external financial APIs.

## Layout

```
src/app/(app)/         pages: / (home), /budget, /payoff, /insights, /investments, /checkin, /settings
src/lib/payoff/        amortization engine + scenario schema (pure TS, tested)
src/lib/invest/        investment projection + RESP grants (pure TS, tested)
src/lib/budget/        budget maths (monthly normalisation, cuts)
src/lib/projection.ts  DB rows + scenario overrides -> engine inputs, net worth
src/lib/actions/       server actions (Zod-validated, audit-logged)
src/lib/insights/      dashboard insight rules + the advisor (recommendations)
src/lib/i18n/strings.ts all UI strings (en + fr)
prisma/                schema, migrations, seed scripts
tests/                 vitest
```
