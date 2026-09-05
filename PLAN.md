# PLAN — Household budget, LOC payoff & investment app

Status: **planning checkpoint — no app code written yet.** This file restates the
build plan and lists the open questions that need answers before seeding real data.

---

## 0. Monthly cash flow (from the numbers in the brief)

All amounts CAD, monthly. Semi-monthly amounts are ×2 (24 pays/year = exactly 2/month).

### Inflow to the spending (joint) account

| Line | Semi-monthly | Monthly |
|---|---:|---:|
| Alex salary → joint | 3 200 | 6 400 |
| Sélia salary → joint | 2 760 | 5 520 |
| **Total inflow** | | **11 920** |

Not counted (never reach the spending account): Alex RRSP payroll 1 061 ×2, Sélia RRSP
payroll 278 ×2, stock plan 707 ×2, child-care payment ≈ 500 (debt paydown only).

### Outflows

| Group | Monthly | Detail |
|---|---:|---|
| Fixed | **4 100** | 1 500 + 700 + 600 + 417 + 360 + 350 + 68 + 55 + 50 |
| Flexible | **1 740** | 600 + 200 + 200 + 200 + 100 + 100 + 100 + 100 + 50 + 50 + 40 |
| Mortgage | 4 752 | |
| Cars (both) | 1 400 | |
| LOC minimum | 336 | |
| Card minimums | **?** | not provided — see the three cases below |
| **Debt payments excl. cards** | **6 488** | |

### Free cash flow = inflow − (fixed + flexible + all debt payments)

| Card-minimum assumption | Card minimums | Total outflow | **Free cash flow** |
|---|---:|---:|---:|
| Cards excluded (lower bound) | 0 | 12 328 | **−408 $/month** |
| Interest-only at 20 % (≈ 83 $ each) | 167 | 12 495 | **−575 $/month** |
| Quebec 5 % of balance (250 $ each) | 500 | 12 828 | **−908 $/month** |

**Conclusion: the budget is in deficit under every assumption**, between roughly
−400 and −900 $/month before lump sums. In Quebec the legal minimum on a card is
5 % of the balance (since Aug 2025), so −908 $/month is the most likely figure
unless the card minimums you enter are lower.

Things worth noticing in the arithmetic:

- **The LOC minimum (336 $) does not cover its own interest.** 70 000 $ × 5.95 % / 12
  = 347,08 $/month. At the minimum the LOC grows by ≈ 11 $/month. (336 $ is
  interest-only at 5.76 %, so either the rate or the balance the bank used is slightly
  different — please confirm.)
- Two of the fixed lines are estimates or new: municipal/school taxes (600, may be 0
  if the lender escrows) and vacation (417, new). Without both, the deficit at the 5 %
  card minimum shrinks to about −(908 − 1 017) = **+109 $/month**. So the sign of the
  free cash flow depends on these two lines — worth confirming before we trust it.
- Annual picture at −908 $/month: the spending account is short ≈ 10 900 $/year,
  which the LOC absorbs. Debt-directed inflows are 6 000 $/year (child care) +
  16 968 $/year (two stock-plan withdrawals) = 22 968 $. Net movement toward
  consumer debt before interest ≈ **+12 000 $/year**, against ≈ 4 200 $/year of LOC
  interest and ≈ 2 000 $/year of card interest at 20 %. So the debt does shrink, but
  slowly (~6 000 $/year net), and only because of the lump sums — this is exactly the
  "negative free cash flow" case the payoff engine must handle explicitly.

---

## 1. Stack

Next.js 15 (App Router) + TypeScript, Tailwind, shadcn/ui, Recharts, Prisma + Postgres
(Neon; `main` branch for prod, `dev` branch for local), Vercel. Vitest for unit tests.
Zod on every input. Money as integer cents; rates as integer basis points (5.95 % = 595).
Single shared password from `HOUSEHOLD_PASSWORD`, HMAC-signed httpOnly session cookie.
No analytics, no third-party scripts, no external APIs.

## 2. Schema (Prisma)

Entities as specified, with these adjustments (reasons in DECISIONS.md):

- `Settings` (singleton): names, language, default scenario, default return (bps),
  home value, cash buffer (default 200 000 ¢), currency locale.
- `Income`: person, name, amountCents, frequency, destination, startDate, endDate?,
  notes, `investmentAccountId?` (when destination is RRSP/stock plan/TFSA — used to
  auto-create the payroll `Contribution`).
- `Expense`: name, category, amountCents, frequency, type (fixed|flexible|savings),
  owner, essential, startDate, endDate?, notes. Monthly normalization is computed,
  never stored (annual/12, quarterly/3, weekly×52/12, bi-weekly×26/12, semi-monthly×2).
- `Debt`: name, type, currentBalanceCents, balanceAsOf, priority, plannedExtraCents,
  **minimumType** (`fixed` | `percentOfBalance` | `interestOnly`) + minimumCents +
  minimumBps + minimumFloorCents, endDate? (car loans), amortizationMonths? and
  renewalDate? (mortgage), `includeInPayoff` (true for LOC/cards, false for
  mortgage/cars by default).
- `DebtRate`: debtId, effectiveDate, annualRateBps. **Rates live in their own table**
  so a variable-rate change is a dated row, not an overwrite. The "current rate" is
  the latest row ≤ today.
- `DebtPayment`: debtId, date, amountCents, type (minimum|extra|lumpSum), note,
  `sourceBonusId?`.
- `LumpSumSchedule`: name, amountCents, months (e.g. `[4, 11]`), startDate, endDate?,
  `sourceIncomeId?` (the stock plan line) — target is always "highest-priority debt
  under the active strategy". This is what models the April/November withdrawals.
- `InvestmentAccount`: owner, name, type, subType?, balanceCents, balanceAsOf,
  returnBps (default 600), includeInNetWorth, `parentId?` — sub-accounts point at a
  roll-up parent (Alex RRSP → individual / group / private market).
- `Contribution`: accountId, amountCents, frequency, source
  (payroll|spendingAccount|lumpSum), startDate, endDate?, `incomeId?` (set when
  auto-created from an Income line; kept in sync).
- `ContributionRoom`: person, accountType (TFSA|RRSP), roomCents, asOf.
- `Scenario`: name, description, isBaseline, `overrides` (JSON validated by a versioned
  Zod schema — see §4), createdBy.
- `Bonus`: person, amountCents, expectedMonth, confidence (unconfirmed|confirmed),
  pctAppliedBps, `debtPaymentId?` (set when confirmed).
- `Snapshot` + `SnapshotDebt`, `SnapshotAccount`, `SnapshotSpend` (one header per
  month with child rows; `note` for "anything unusual").
- `AuditLog`: entity, entityId, action, editedBy (Alex|Sélia), before/after JSON, at.
  Every mutation writes one row; every editable table also carries `updatedBy`.

## 3. Folder structure

```
app/
  (auth)/login/            shared-password form
  page.tsx                 Dashboard
  budget/  payoff/  investments/  checkin/  settings/
  api/…                    route handlers for CSV import/export only
components/                shadcn/ui + app components (tables, drawers, charts)
lib/
  money.ts                 cents ↔ display, fr-CA / en-CA formatting
  frequency.ts             normalize any frequency to monthly (pure, tested)
  budget/                  free-cash-flow, committed vs flexible, sinking funds
  payoff/                  amortization engine (pure TS, tested)  ← §4
  invest/                  projection engine + RESP grants (pure TS, tested) ← §5
  insights/                rule-based sentences
  i18n/strings.ts          all UI strings, en + fr keys
  actions/                 server actions (Zod-validated, write AuditLog)
prisma/
  schema.prisma  seed.ts  seed.household.ts (gitignored)  seed.household.example.ts
tests/                     vitest, one file per engine + hand-computed fixtures
PLAN.md  DECISIONS.md
```

## 4. Payoff engine (`lib/payoff`)

**Time step: one calendar month.** Interest posts at month end; all payments are
applied at month end in this order. Semi-monthly income is folded into a monthly
amount (×2). Intra-month timing is ignored (DECISIONS.md quantifies the error:
< 1 $/month on a 70 k LOC).

Inputs (all plain data, no DB): list of debts `{balance, rates[], minimum rule,
scheduled payment, priority, endDate?, includeInPayoff}`, monthly free cash flow,
extra monthly payment (with optional start date), lump-sum schedule (recurring +
one-off), strategy (`avalanche` | `snowball` | `locFirst`), roll-down flag, cash buffer,
horizon (default 480 months), start month.

Per month `m`:

1. `rate(debt, m)` = latest `DebtRate` with effectiveDate ≤ first of month
   (scenario rate overrides are just extra rows).
2. `interest = round(balance × rate / 12)`; `balance += interest`.
3. Pay each debt's scheduled/minimum amount (rule-based: fixed, % of balance with
   floor, or interest-only), capped at balance. Car loans and mortgage are paid but
   never receive extra unless `includeInPayoff` is on.
4. Build the **extra pool** = scenario extra (if started) + `debt paydown` incomes
   (child care) + rolled-down payments from debts that ended (paid off, or car loan
   past its endDate — only if roll-down is on) + this month's lump sums.
5. If **free cash flow < 0**, the shortfall is added to the LOC balance first (the LOC
   is the revolving account that absorbs the deficit) and the result flags
   `deficitFinancedByLoc = true` for the month.
6. Apply the extra pool to debts ordered by strategy (avalanche: highest rate first;
   snowball: lowest balance first; locFirst: LOC then avalanche). Spill-over goes to
   the next debt.
7. Record `{month, perDebt: {balance, interest, principal, payment}, totals,
   cumulativeInterest}`.
8. Stop when all `includeInPayoff` debts are 0 → payoff date; or when the horizon is
   reached → `outcome: "never"` with the average annual growth of the balance, so the
   page can say *"at this pace the LOC grows by X $/year"* instead of a date.

Other outputs: total interest, months to payoff, interest by debt, first month each
debt hits zero, and the schedule of freed payments (so the UI can show "car 1 ends
2027-03 → +700 $/month to LOC").

**Reverse solver:** payoff month is monotone non-increasing in extra payment, so
bisection on `extra ∈ [0, 20 000 $]` (40 iterations, to the cent) gives "required
monthly payment for a target date"; the other direction is just a normal run.

**Bonus overlay:** a second run with the unconfirmed bonuses added as one-off lump
sums (× pct applied). Never touches the baseline or plan-vs-actual.

**Plan vs actual:** the projection is re-anchored at the latest Snapshot (actual
balances) and compared month-by-month to the projection saved at the previous
check-in; drift = months between the two payoff dates.

**Scenario overrides** (Zod, versioned `v: 1`): `extraMonthly {cents, startDate?}`,
`lumpSums[] {date, cents, label}`, `rateChanges[] {debtId, date, bps}`,
`expenseCuts[] {expenseId | category, cents | pct}`, `redirects[] {contributionId,
months, startDate}`, `strategy`, `rollDown: boolean`. Expense cuts and redirects
change the free cash flow **and** the investment projection inputs; both engines
consume the same resolved inputs.

## 5. Investment projection engine (`lib/invest`)

Monthly compounding with an **effective** annual return converted to monthly:
`r_m = (1 + r)^(1/12) − 1` (so a 6 % assumption grows exactly 6 % per year).

Per account per month: `B_{t+1} = B_t × (1 + r_m) + C_t`, contributions at month end,
semi-monthly ×2, annual/12 etc. via the shared frequency module. Pauses and
redirects zero out `C_t` for the given months. Sub-accounts are projected
individually and summed into the roll-up; Cash accounts use 0 %.

**RESP grants** (toggle): CESG = 20 % of contributions, max **500 $/year**, lifetime
**7 200 $**; QESI = 10 %, max **250 $/year**, lifetime **3 600 $**. Grants are added
in the month of the contribution and grow at the account's return. Carry-forward of
unused grant room is **not** modelled in v1 (noted in DECISIONS.md). Both caps are
constants in one file so they are easy to verify.

**Net worth** = Σ balances of `includeInNetWorth` accounts − (LOC + cards + car loans);
toggle adds `homeValue − mortgageBalance`.

**Contribution room** = entered room − contributions since the room's as-of date.

## 6. Build order (commit after each)

(a) schema + `seed.ts` + `seed.household.ts` · (b) payoff engine + tests ·
(c) investment engine + tests · (d) Budget page → **deploy to Vercel** ·
(e) Payoff page · (f) Investments · (g) Dashboard · (h) Check-in · (i) Settings ·
(j) French labels (optional, last).

Unit-test coverage required by the brief: interest-only minimum, negative cash flow
(balance grows), semi-annual lump sums, mid-plan rate change, extra payment starting
later, reverse solve to a date; investment: monthly compounding with contributions,
pause, RESP grants with caps. Each with a hand-computed fixture shown in the test file.

## 7. Assumptions I will use unless told otherwise

1. Card minimums: **5 % of balance, floor 10 $** (Quebec rule), rate **20 %** for both.
2. The 336 $ LOC minimum is modelled as `interestOnly` at the current rate (so it
   tracks the balance), not as a fixed 336 $.
3. The deficit is financed by the LOC (not by the emergency fund).
4. Vacation (417) and tax (600) lines stay in the baseline as given.
5. Stock-plan lump sums: 8 484 $ on the last day of April and November, editable.
6. Child-care 500 $/month goes into the extra pool every month, avalanche order.
7. Baseline strategy: avalanche; roll-down on; cash buffer 2 000 $; return 6 %.
8. Car loans, mortgage: I will seed placeholder values (see questions) and mark them
   `estimate` in the notes field so they are visibly unconfirmed in the UI.

## 8. Open questions — please answer before I seed real data

**Placeholders in the brief**
1. Pay dates for Alex and Sélia (only affects the check-in calendar, not the math).
2. Credit cards: rate and minimum rule for each (fixed $, % of balance, or issuer's
   formula). Confirm 20 % / 5 % if unsure.
3. Car 1 and Car 2: balance, rate, monthly payment, end date each (they total 1 400).
4. Mortgage: amortization (years) and renewal date; is it fixed or variable?
5. Contribution room: Alex TFSA / RRSP, Sélia TFSA / RRSP.
6. Estimated home value.
7. Tax refund: estimate and month, or "none".

**Numbers that change the sign of the cash flow**
8. Municipal + school taxes: real annual bills (Candiac, Feb 5 + Jun 4; school tax
   summer)? Or does the lender collect them inside the 4 752 $?
9. Is the 4 752 $ mortgage payment monthly, or is it a bi-weekly/semi-monthly figure?
10. LOC: is the rate 5.95 % and the minimum 336 $ both current? (336 $ is below the
    monthly interest at 5.95 % — see §0.)
11. Do you currently actually run ~900 $/month short (LOC balance creeping up between
    stock-plan withdrawals)? If not, one of the expense lines is over-estimated and
    I'd rather find it now.

**Possibly missing expenses (from your own list)**
12. Life / disability insurance premiums (not in the 360 $ line)?
13. SAAQ registration + licences (annual), car maintenance / tires / winter storage?
14. Medical / dental / pharmacy out of pocket, adult clothing, cell phones (inside
    Utilities?).
15. Should the 2 000 $ emergency fund grow to a target before extra goes to debt
    (i.e. cash buffer > 2 000 $)?

**Design choices I'd like you to confirm**
16. Deficit handling: model the shortfall as LOC growth (my default) — or as the
    emergency fund draining first?
17. Stock plan: apply the withdrawal to cards first (avalanche) in the baseline, even
    though today it goes to the LOC? The brief says both; avalanche is my default and
    the comparison view will show LOC-first.
18. Employer match on the group RRSPs (Accenture, Alstom): is there one, and should it
    count as a contribution in the projection (it does not touch cash flow)?
