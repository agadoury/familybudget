import { loadHousehold, loadScenarios, loadSnapshots } from "@/lib/db/load";
import { toHouseholdDTO, toSnapshotDTO } from "@/lib/dto-household";
import { PayoffClient } from "./payoff-client";

export default async function PayoffPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [data, scenarios, snapshots, sp] = await Promise.all([loadHousehold(), loadScenarios(), loadSnapshots(), searchParams]);
  return (
    <PayoffClient
      data={toHouseholdDTO(data)}
      scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, description: s.description, isBaseline: s.isBaseline, overrides: s.overrides }))}
      snapshots={snapshots.map(toSnapshotDTO)}
      initialScenarioId={sp.scenario ?? null}
    />
  );
}
