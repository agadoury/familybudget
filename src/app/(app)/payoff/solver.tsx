"use client";
import * as React from "react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payoffWithExtra, solveExtraForTarget } from "@/lib/payoff";
import { addMonths } from "@/lib/frequency";
import { parseMoney } from "@/lib/money";
import type { Projection } from "@/lib/projection";

export function Solver({ projection }: { projection: Projection }) {
  const { money, month, lang } = useApp();
  const [target, setTarget] = React.useState(addMonths(projection.payoffInput.startMonth, 24));
  const [afford, setAfford] = React.useState("1000");
  const solved = React.useMemo(() => (target ? solveExtraForTarget(projection.payoffInput, target) : null), [projection.payoffInput, target]);
  const affordCents = parseMoney(afford) ?? 0;
  const affordRun = React.useMemo(() => payoffWithExtra(projection.payoffInput, affordCents), [projection.payoffInput, affordCents]);
  return (
    <Card>
      <CardContent className="pt-4 grid gap-6 md:grid-cols-2 text-sm">
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Nous voulons être sans dette le" : "We want to be debt-free by"}</Label>
          <input type="month" className="cell-input border-border w-auto" value={target} min={projection.payoffInput.startMonth} onChange={(e) => setTarget(e.target.value)} aria-label="Target month" />
          <p className="text-base">
            {solved
              ? lang === "fr"
                ? <>→ paiement mensuel requis : <strong>{money(solved.extraCents)}</strong> de plus que le scénario actuel (remboursé en {month(solved.result.outcome.kind === "paid" ? solved.result.outcome.month : target)}, intérêts {money(solved.result.consumerInterestCents, { compact: true })}).</>
                : <>→ required monthly payment: <strong>{money(solved.extraCents)}</strong> on top of the current scenario (paid off {month(solved.result.outcome.kind === "paid" ? solved.result.outcome.month : target)}, interest {money(solved.result.consumerInterestCents, { compact: true })}).</>
              : lang === "fr" ? "→ impossible d'ici cette date, même avec 50 000 $/mois." : "→ not reachable by that date, even at 50 000 $/month."}
          </p>
        </div>
        <div className="space-y-2">
          <Label>{lang === "fr" ? "Nous pouvons payer (par mois, en plus)" : "We can afford (per month, extra)"}</Label>
          <Input className="w-40 text-right tabular" inputMode="decimal" value={afford} onChange={(e) => setAfford(e.target.value)} aria-label="Affordable amount" />
          <p className="text-base">
            {affordRun.outcome.kind === "paid"
              ? lang === "fr" ? <>→ remboursé en <strong>{month(affordRun.outcome.month)}</strong> ({affordRun.outcome.months} mois), intérêts {money(affordRun.consumerInterestCents, { compact: true })}.</>
                : <>→ paid off <strong>{month(affordRun.outcome.month)}</strong> ({affordRun.outcome.months} months), interest {money(affordRun.consumerInterestCents, { compact: true })}.</>
              : lang === "fr" ? "→ jamais remboursé à ce rythme." : "→ never paid off at that pace."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
