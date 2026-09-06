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
4. **Open the URL and enter the household passphrase.** The repository ships your real numbers as an
   encrypted bundle (`prisma/household.enc.json`, AES-256-GCM, key derived with scrypt). The first
   visit asks for the passphrase: it unlocks the numbers, loads them, and becomes the app password.
   Change the password afterwards in Settings if you like; the passphrase is only needed again for
   *Settings → Load our real numbers*, which wipes and reloads everything.

   To refresh the bundle after editing `prisma/seed.household.ts` (gitignored, on your computer):
   ```bash
   HOUSEHOLD_PASSPHRASE="<the passphrase>" npx tsx scripts/encrypt-household.ts && git commit -am "Update household numbers" && git push
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
