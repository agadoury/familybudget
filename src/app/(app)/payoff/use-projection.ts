"use client";
import * as React from "react";
import { monthKey } from "@/lib/frequency";
import { buildProjection, type HouseholdData, type Projection } from "@/lib/projection";
import type { ScenarioOverrides } from "@/lib/payoff";
import type { HouseholdDTO } from "@/lib/dto-household";

export function useStartMonth() {
  return React.useMemo(() => monthKey(new Date()), []);
}

export function asHousehold(d: HouseholdDTO): HouseholdData {
  return d as unknown as HouseholdData;
}

export function useProjection(data: HouseholdDTO, overrides: ScenarioOverrides, opts: { withBonuses?: boolean; respGrants?: boolean } = {}): Projection {
  const startMonth = useStartMonth();
  return React.useMemo(
    () => buildProjection(asHousehold(data), { startMonth, overrides, withBonuses: opts.withBonuses, respGrants: opts.respGrants }),
    [data, overrides, startMonth, opts.withBonuses, opts.respGrants],
  );
}
