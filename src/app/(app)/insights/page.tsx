import { prisma } from "@/lib/db/prisma";
import { loadHousehold, loadScenarios, loadSnapshots } from "@/lib/db/load";
import { toHouseholdDTO, toSnapshotDTO } from "@/lib/dto-household";
import { InsightsClient } from "./insights-client";

export default async function InsightsPage() {
  const [data, scenarios, snapshots, rooms] = await Promise.all([loadHousehold(), loadScenarios(), loadSnapshots(), prisma.contributionRoom.findMany()]);
  const dto = toHouseholdDTO(data);
  const active = scenarios.find((s) => s.id === dto.settings.defaultScenarioId) ?? scenarios.find((s) => s.isBaseline) ?? null;
  return (
    <InsightsClient
      data={dto}
      snapshots={snapshots.map(toSnapshotDTO)}
      rooms={rooms.map((r) => ({ person: r.person, accountType: r.accountType as "TFSA" | "RRSP", roomCents: r.roomCents }))}
      defaultOverrides={active?.overrides ?? null}
      defaultName={active?.name ?? null}
    />
  );
}
