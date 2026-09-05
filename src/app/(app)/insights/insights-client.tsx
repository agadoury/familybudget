"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightbulb, Wallet, CreditCard, Sprout, Baby, Wrench, Play, ChevronDown } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { PageHeader, Callout } from "@/components/app/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import type { HouseholdDTO, SnapshotDTO } from "@/lib/dto-household";
import { advise, type Category, type Horizon, type Recommendation, type RoomRow } from "@/lib/insights/advisor";
import { saveScenario } from "@/lib/actions/scenarios";
import { cn } from "@/lib/utils";

const CAT_ICON: Record<Category, React.ReactNode> = { cashflow: <Wallet />, debt: <CreditCard />, investing: <Sprout />, family: <Baby />, housekeeping: <Wrench /> };

export function InsightsClient({ data, snapshots, rooms, defaultOverrides, defaultName }: { data: HouseholdDTO; snapshots: SnapshotDTO[]; rooms: RoomRow[]; defaultOverrides: ScenarioOverrides | null; defaultName: string | null }) {
  const { t, money, pct, month, lang, personName } = useApp();
  const fr = lang === "fr";
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const report = React.useMemo(() => advise(data, snapshots, rooms, { money, pct, month, lang, personName }, new Date(), defaultOverrides ?? EMPTY_OVERRIDES), [data, snapshots, rooms, money, pct, month, lang, personName, defaultOverrides]);

  const horizonLabel: Record<Horizon, { title: string; hint: string }> = fr
    ? { now: { title: "À faire maintenant", hint: "Les gestes qui changent le plus la date." }, next: { title: "Dans les 12 prochains mois", hint: "À préparer, à décider ensemble." }, later: { title: "Plus tard, à garder en tête", hint: "Quand la dette est derrière vous." }, housekeeping: { title: "Entretien", hint: "Pour que les conseils restent justes." } }
    : { now: { title: "Do now", hint: "The moves that change the date the most." }, next: { title: "In the next 12 months", hint: "To prepare and decide together." }, later: { title: "Later, keep in mind", hint: "Once the debt is behind you." }, housekeeping: { title: "Housekeeping", hint: "So the advice stays accurate." } };
  const catLabel: Record<Category, string> = fr
    ? { cashflow: "Budget", debt: "Dettes", investing: "Placements", family: "Famille", housekeeping: "Entretien" }
    : { cashflow: "Cash flow", debt: "Debt", investing: "Investing", family: "Family", housekeeping: "Housekeeping" };

  function tryIt(r: Recommendation) {
    if (!r.tryOverrides) return;
    start(async () => {
      const res = await saveScenario(null, { name: r.tryName ?? r.title, description: r.why, overrides: r.tryOverrides });
      if (!res.ok) return void toast.error(res.error);
      router.push(`/payoff?scenario=${res.data.id}`);
    });
  }

  const byHorizon = (h: Horizon) => report.recommendations.filter((r) => r.horizon === h);

  return (
    <div className="space-y-6">
      <PageHeader title={fr ? "Conseils" : "Insights"} subtitle={fr ? "Ce que je ferais ensuite, dans l’ordre — chaque chiffre vient de votre propre budget." : "What I would do next, in order — every number comes from your own budget."} />

      <Card>
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Lightbulb className="h-5 w-5" /></div>
            <p className="text-base md:text-lg leading-snug">{report.headline}</p>
          </div>
          {report.summary.length > 0 && (
            <ol className="grid gap-2 md:grid-cols-2 pl-1">
              {report.summary.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
          {defaultName && <p className="text-xs text-muted-foreground">{fr ? "Plan de référence" : "Baseline plan"}: {defaultName}</p>}
        </CardContent>
      </Card>

      {(["now", "next", "later", "housekeeping"] as Horizon[]).map((h) => {
        const items = byHorizon(h);
        if (items.length === 0) return null;
        return (
          <section key={h} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{horizonLabel[h].title}</h2>
              <p className="text-sm text-muted-foreground">{horizonLabel[h].hint}</p>
            </div>
            <div className="grid gap-3">
              {items.map((r) => <RecCard key={r.id} r={r} catLabel={catLabel[r.category]} onTry={r.tryOverrides ? () => tryIt(r) : undefined} pending={pending} />)}
            </div>
          </section>
        );
      })}

      <Collapsible>
        <Card>
          <CollapsibleTrigger className="p-5 rounded-2xl">{fr ? "Hypothèses derrière ces conseils" : "Assumptions behind this advice"}</CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">{report.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              <p className="text-xs text-muted-foreground mt-3">{fr ? "Ces conseils sont calculés par des règles à partir de vos chiffres ; ils ne remplacent pas un planificateur financier qui connaît toute votre situation." : "This advice is computed by rules from your own numbers; it does not replace a financial planner who knows your full situation."}</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      {t("common.loading") && null}
    </div>
  );
}

function RecCard({ r, catLabel, onTry, pending }: { r: Recommendation; catLabel: string; onTry?: () => void; pending: boolean }) {
  const { lang } = useApp();
  const fr = lang === "fr";
  const [open, setOpen] = React.useState(r.horizon === "now");
  return (
    <Card className={cn(r.horizon === "now" && "border-primary/30")}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:h-4.5 [&_svg]:w-4.5">{CAT_ICON[r.category]}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{catLabel}</Badge>
              {r.impact.filter((i) => i.tone === "good").slice(0, 2).map((i) => <Badge key={i.label} variant="good">{i.value}</Badge>)}
            </div>
            <h3 className="text-base md:text-lg font-semibold leading-snug mt-1.5">{r.title}</h3>
            <p className="text-sm text-foreground/85 mt-1.5 leading-relaxed">{r.why}</p>
          </div>
        </div>

        {r.impact.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {r.impact.map((i) => (
              <div key={i.label} className="rounded-xl bg-muted/60 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{i.label}</div>
                <div className={cn("font-semibold tabular text-sm", i.tone === "good" && "text-good", i.tone === "act" && "text-act", i.tone === "watch" && "text-watch")}>{i.value}</div>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-primary">
          {fr ? "Quoi faire" : "What to do"} <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="space-y-3">
            <ol className="space-y-2">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-xs font-semibold mt-0.5">{i + 1}</span><span>{s}</span></li>
              ))}
            </ol>
            {r.caveats?.map((c) => <Callout key={c} tone="info" className="text-xs">{c}</Callout>)}
            {onTry && <Button size="sm" variant="soft" disabled={pending} onClick={onTry}><Play /> {fr ? "Essayer ce plan" : "Try this plan"}</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
