# Household budget, LOC payoff & investment app

Private web app for two people: budget, consumer-debt payoff planning (LOC + credit cards), investment
projections, monthly check-in. Next.js 15 (App Router) + TypeScript + Tailwind, Prisma + Postgres, Recharts.
All money is stored as integer cents; rates as basis points. See `PLAN.md` for the model and `DECISIONS.md`
for trade-offs.

## Deploy in 10 minutes (Vercel only, no other accounts)

1. **Import the repo.** Go to [vercel.com/new](https://vercel.com/new), pick `familybudget`, leave the
   defaults. Under *Environment Variables* add:
   - `HOUSEHOLD_PASSWORD` — the password you and Sélia will type
   - `SESSION_SECRET` — any long random string (32+ characters)
   Click **Deploy**. The first build will fail because there is no database yet — that is expected.
2. **Add the database.** In the project, open the **Storage** tab → **Create Database** → **Postgres**
   → accept the defaults → **Connect** to the project. Vercel injects `DATABASE_URL` (and the
   unpooled variant) into the project automatically. Nothing to copy.
3. **Redeploy.** *Deployments* → latest → **Redeploy**. The build runs the migrations itself
   (`npm run vercel-build`), then starts the app. Open the URL and sign in.
4. **Load your numbers once.** The app starts empty (or use *Settings → Reset demo data* to look
   around). To load your real numbers, on your computer:
   ```bash
   git clone https://github.com/agadoury/familybudget && cd familybudget && npm install
   cp prisma/seed.household.example.ts prisma/seed.household.ts   # fill in your numbers (this file never leaves your machine)
   DATABASE_URL="<paste: Vercel → Storage → your database → .env.local tab → DATABASE_URL>" npm run db:seed:household
   ```
   From then on everything is edited in the app.

Optional: in the Vercel project **Settings → Git**, set the production branch to `main`.
Vercel's free Hobby plan is enough for two people; the database's free tier is plenty for this data.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL, HOUSEHOLD_PASSWORD, SESSION_SECRET
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
