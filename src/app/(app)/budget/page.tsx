import { loadHousehold } from "@/lib/db/load";
import { toAccountDTO, toContributionDTO, toExpenseDTO, toIncomeDTO } from "@/lib/dto";
import { currentRateBps, scheduledNow } from "@/lib/projection";
import { BudgetTable } from "./budget-table";

export default async function BudgetPage() {
  const data = await loadHousehold();
  const debts = data.debts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balanceCents: d.balanceCents,
    scheduledCents: scheduledNow(d),
    currentRateBps: currentRateBps(d),
    minimumType: d.minimumType,
  }));
  return (
    <BudgetTable
      incomes={data.incomes.map(toIncomeDTO)}
      expenses={data.expenses.map(toExpenseDTO)}
      contributions={data.contributions.map(toContributionDTO)}
      accounts={data.accounts.map(toAccountDTO)}
      debts={debts}
    />
  );
}
