# DECISIONS

Trade-offs made without asking, with the reason. Newest at the bottom.

1. **Monthly time step in the payoff engine, semi-monthly income folded ×2.**
   Interest on a LOC accrues daily and is posted monthly; modelling half-month payment
   timing would change the result by less than 1 $/month on a 70 k balance
   (≈ 3 400 $ paid mid-month × 5.95 % × 1/24 ≈ 8 $/month at most, in practice far
   less because only the extra part is timing-sensitive). Not worth the complexity.
2. **Rates in a separate `DebtRate` table (dated rows) instead of a column on `Debt`.**
   The brief asks for editable dated rate changes; a history table gives that for free
   and lets scenarios add future rows without copying the debt.
3. **Scenario overrides stored as versioned JSON validated by Zod, not as six tables.**
   Overrides are heterogeneous, only ever read by the engine, and small. A `v` field
   allows migrations. Referenced expenses/contributions are stored by id so cuts and
   redirects are "pulled from the Budget page, not retyped".
4. **Sub-accounts via `parentId` on `InvestmentAccount`** rather than a separate
   table: same fields, same projection code, roll-up is a `groupBy(parentId ?? id)`.
5. **Effective annual return converted to monthly** (`(1+r)^(1/12) − 1`), not `r/12`.
   "6 %" then means exactly 6 % per year, which is what a person entering 6 % expects.
6. **RESP grant caps**: CESG 20 %, 500 $/year, 7 200 $ lifetime; QESI 10 %, 250 $/year,
   3 600 $ lifetime. Carry-forward of unused room (CESG up to 1 000 $/year, QESI up to
   500 $/year) is not modelled in v1 — it would need a per-child grant history.
7. **Card minimum default = 5 % of balance (floor 10 $)**, the Quebec statutory minimum
   since August 2025, used until real figures are entered.
8. **Deficit is financed by the LOC**, not by the emergency fund, because the brief
   describes the LOC as the account that grows when the budget is short.
9. **Scenario "extra payment" and the reverse solver mean *new money*.** With a deficit budget,
   an extra taken from the spending account is a wash (the LOC finances it). So extras are
   applied to debt in full, the deficit still grows the LOC every month, and the page shows a
   `fundingGap` banner when the extra exceeds free cash flow. Expense cuts and redirected savings
   are the levers that actually change the deficit; the UI says so plainly.
10. **Roll-down generalised to "freed scheduled payment".** freed = month-0 scheduled payments −
    this month's scheduled payments. That covers a lease ending, a card being paid off, and a
    percent-of-balance minimum shrinking (you keep paying what you paid). Off → the freed money
    shows up as unallocated cash instead.
11. **Leases are a `Debt` of type LEASE with no balance and no interest**, only a scheduled payment
    and an optional end date. Both cars are leases (700 $ each); no end dates were given, so the
    payments continue until one is entered.
12. **Stock plan is an Income line (destination STOCK_PLAN) + a `LumpSumSchedule`**, not an
    investment account with contributions, to avoid counting the same dollars as growing
    investments *and* as debt lump sums.
13. **Payroll RRSP lines own their `Contribution` row** (`incomeId` link); edit the income, not
    the contribution. Deleting the income deletes the contribution.
14. **Check-in balances are authoritative.** Lump sums entered at check-in are logged as
    `DebtPayment` rows for the record (and confirm a bonus) but do not decrement the balance
    again, because the balance typed in step 1 already reflects them.
15. **Plan vs actual re-projects from the previous check-in's balances** rather than storing full
    curves: cheap, and it always uses the current baseline rules.
16. **Sinking-fund insight assumes the annual bill is due on the anniversary of the expense's
    start date** (there is no due-date field). Set the start date to the bill month to make it
    accurate.
17. **Candiac tax estimate**: municipal 6 600 $/yr (Feb 5 + Jun 4) and school 1 100 $/yr, based on
    ≈ 0,55 $ + 0,09 $ per 100 $ on an assessed value near 1,1 M. Marked "estimate" in the app.
18. **TFSA room estimated from age** (full room since 18: Alex from 2011 ≈ 99 000 $, Sélia from
    2014 ≈ 83 500 $ less ≈ 2 350 $ contributed) and **RRSP room from salary** (18 % of 170 k ≈
    30 600 $ for one year; Sélia ≈ 45 000 $ assuming ~3 years unused). Both marked "estimate".
19. **shadcn/ui components are hand-written on Radix primitives** (the shadcn registry was not
    reachable from the build environment). Same API surface, smaller set.
20. **The middleware only checks the cookie exists**; the HMAC token is verified in the server
    layout on every request (Edge runtime has no node:crypto). Login is rate-limited only by
    Vercel; the password is shared and long-lived by design.
21. **No Vercel deploy from the build environment** (no Vercel/Neon credentials available). The
    README has the exact steps; `npm run vercel-build` runs migrations before the build.
22. **Design pass for everyday use.** One idea per screen: a plain sentence and one big number
    first, details one tap away. Inline editing is kept on laptops (name + amount, Tab through
    rows); on phones rows are tap-to-open and every field lives in a bottom drawer with large
    inputs. Advanced scenario levers sit under "More options". Colours always come with a word
    or icon (never colour alone). Nothing was removed; the month-by-month table, comparison,
    solver, bonuses and debt editor are still on the Debt plan page.
