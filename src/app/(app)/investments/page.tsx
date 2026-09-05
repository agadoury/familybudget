import { prisma } from "@/lib/db/prisma";
import { loadHousehold, loadScenarios } from "@/lib/db/load";
import { toHouseholdDTO } from "@/lib/dto-household";
import { iso } from "@/lib/dto";
import { InvestmentsClient } from "./investments-client";

export default async function InvestmentsPage() {
  const [data, scenarios, rooms] = await Promise.all([loadHousehold(), loadScenarios(), prisma.contributionRoom.findMany()]);
  return (
    <InvestmentsClient
      data={toHouseholdDTO(data)}
      scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, description: s.description, isBaseline: s.isBaseline, overrides: s.overrides }))}
      rooms={rooms.map((r) => ({ id: r.id, person: r.person, accountType: r.accountType as "TFSA" | "RRSP", roomCents: r.roomCents, asOf: iso(r.asOf)!, notes: r.notes }))}
    />
  );
}
