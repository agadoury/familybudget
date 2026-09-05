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
