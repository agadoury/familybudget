import { getSettings, loadScenarios } from "@/lib/db/load";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const [s, scenarios] = await Promise.all([getSettings(), loadScenarios()]);
  return (
    <SettingsClient
      settings={{ alexName: s.alexName, seliaName: s.seliaName, language: s.language, defaultScenarioId: s.defaultScenarioId, defaultReturnBps: s.defaultReturnBps, homeValueCents: s.homeValueCents, cashBufferCents: s.cashBufferCents, includeHomeEquity: s.includeHomeEquity, alexGrossIncomeCents: s.alexGrossIncomeCents, seliaGrossIncomeCents: s.seliaGrossIncomeCents }}
      scenarios={scenarios.map((x) => ({ id: x.id, name: x.name }))}
    />
  );
}
