import { loadHousehold, loadScenarios, loadSnapshots } from "@/lib/db/load";
import { toHouseholdDTO, toSnapshotDTO } from "@/lib/dto-household";
import { CheckinClient } from "./checkin-client";

export default async function CheckinPage() {
  const [data, scenarios, snapshots] = await Promise.all([loadHousehold(), loadScenarios(), loadSnapshots()]);
  const baseline = scenarios.find((s) => s.isBaseline);
  return <CheckinClient data={toHouseholdDTO(data)} baselineOverrides={baseline?.overrides ?? null} snapshots={snapshots.map(toSnapshotDTO)} />;
}
