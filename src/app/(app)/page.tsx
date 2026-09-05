import { loadHousehold, loadScenarios, loadSnapshots } from "@/lib/db/load";
import { toHouseholdDTO, toSnapshotDTO } from "@/lib/dto-household";
import { Dashboard } from "./dashboard";

export default async function DashboardPage() {
  const [data, scenarios, snapshots] = await Promise.all([loadHousehold(), loadScenarios(), loadSnapshots()]);
  const dto = toHouseholdDTO(data);
  const active = scenarios.find((s) => s.id === dto.settings.defaultScenarioId) ?? scenarios.find((s) => s.isBaseline) ?? null;
  const baseline = scenarios.find((s) => s.isBaseline) ?? null;
  return (
    <Dashboard
      data={dto}
      activeScenario={active ? { id: active.id, name: active.name, overrides: active.overrides } : null}
      baselineOverrides={baseline?.overrides ?? null}
      snapshots={snapshots.map(toSnapshotDTO)}
    />
  );
}
