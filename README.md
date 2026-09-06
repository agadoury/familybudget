# Household budget, LOC payoff & investment app

Private web app for two people: budget, consumer-debt payoff planning (LOC + credit cards), investment
projections, monthly check-in. Next.js 15 (App Router) + TypeScript + Tailwind, Prisma + Postgres, Recharts.
All money is stored as integer cents; rates as basis points. See `PLAN.md` for the model and `DECISIONS.md`
for trade-offs.

## Deploy in 5 minutes (Vercel only, nothing to configure)

1. **Import the repo** at [vercel.com/new](https://vercel.com/new): pick `familybudget`, keep every default,
   click **Deploy**. No environment variables needed.
2. **Create the database**: in the project, **Storage** → **Create Database** → **Postgres** → accept the
   defaults → **Connect**. Vercel wires it up by itself.
3. **Redeploy**: **Deployments** → latest → ⋯ → **Redeploy**. The build creates the tables.
4. **Open the URL.** The first visit asks you to choose the household password (change it later in
   Settings). Then use *Settings → Reset demo data* to look around, or load your real numbers once from
   your computer:
   ```bash
   git clone https://github.com/agadoury/familybudget && cd familybudget && npm install
   cp prisma/seed.household.example.ts prisma/seed.household.ts   # fill in your numbers (never committed)
   DATABASE_URL="<Vercel → Storage → your database → .env.local tab → DATABASE_URL>" npm run db:seed:household
   ```

Until the database exists, the URL shows an “Almost there” page with these steps. Optional overrides:
`HOUSEHOLD_PASSWORD` (fixed password instead of the in-app one) and `SESSION_SECRET` (otherwise derived
from the database connection). Set the production branch to `main` under *Settings → Git*.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL (password and secret are optional)
npm install
npx prisma migrate dev          # creates the schema
npm run db:seed                 # demo data (or npm run db:seed:household for your numbers)
npm run dev                     # http://localhost:3000
npm test                        # engine unit tests
```

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
