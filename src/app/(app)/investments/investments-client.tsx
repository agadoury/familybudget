"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { MoneyCell, DateCell } from "@/components/app/inline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, ListRow, EmptyState, Section } from "@/components/app/page";
import { Wallet, Trash2 as TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LinesChart } from "@/components/charts/lines-chart";
import { CHART_COLORS } from "@/components/charts/theme";
import { EMPTY_OVERRIDES, type ScenarioOverrides } from "@/lib/payoff";
import { buildProjection } from "@/lib/projection";
import { monthDiff, monthKey, toMonthlyCents } from "@/lib/frequency";
import { parseMoney } from "@/lib/money";
import { CESG_ANNUAL_CAP_CENTS, CESG_LIFETIME_CAP_CENTS, QESI_ANNUAL_CAP_CENTS, QESI_LIFETIME_CAP_CENTS } from "@/lib/invest";
import type { HouseholdDTO, ScenarioDTO } from "@/lib/dto-household";
import type { AccountInput } from "@/lib/schemas";
import { createAccount, deleteAccount, updateAccount, upsertContributionRoom } from "@/lib/actions/investments";
import { createContribution } from "@/lib/actions/budget";
import { saveScenario } from "@/lib/actions/scenarios";
import { asHousehold, useStartMonth } from "../payoff/use-projection";

type Account = HouseholdDTO["accounts"][number];
type Room = { id: string; person: "ALEX" | "SELIA"; accountType: "TFSA" | "RRSP"; roomCents: number; asOf: string; notes: string | null };
const TYPES = ["RRSP", "TFSA", "RESP", "NON_REGISTERED", "STOCK_PLAN", "CASH"] as const;
const OWNERS = ["ALEX", "SELIA", "JOINT"] as const;
const STALE_DAYS = 60;
const today = () => new Date().toISOString().slice(0, 10);

export function InvestmentsClient({ data, scenarios, rooms }: { data: HouseholdDTO; scenarios: ScenarioDTO[]; rooms: Room[] }) {
  const { t, money, pct, lang, personName } = useApp();
  const router = useRouter();
  const startMonth = useStartMonth();
  const baseline = scenarios.find((s) => s.isBaseline);
  const [years, setYears] = React.useState<5 | 10 | 20 | 30>(10);
  const [respGrants, setRespGrants] = React.useState(true);
  const [includeHome, setIncludeHome] = React.useState(data.settings.includeHomeEquity);
  const [whatIf, setWhatIf] = React.useState<{ returnBps: number | null; pauseMonths: number }>({ returnBps: null, pauseMonths: 0 });
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [edit, setEdit] = React.useState<Partial<AccountInput>>({});
  const [form, setForm] = React.useState<AccountInput>({ owner: "ALEX", name: "", type: "TFSA", subType: null, parentId: null, balanceCents: 0, balanceAsOf: today(), returnBps: data.settings.defaultReturnBps, includeInNetWorth: true, notes: null });
  const [newContrib, setNewContrib] = React.useState({ accountId: "", amount: "" });
  const [pending, start] = React.useTransition();

  const typeLabel: Record<(typeof TYPES)[number], string> = lang === "fr"
    ? { RRSP: "REER", TFSA: "CELI", RESP: "REEE", NON_REGISTERED: "Non enregistré", STOCK_PLAN: "Régime d'actions", CASH: "Encaisse" }
    : { RRSP: "RRSP", TFSA: "TFSA", RESP: "RESP", NON_REGISTERED: "Non-registered", STOCK_PLAN: "Stock plan", CASH: "Cash" };

  const overrides: ScenarioOverrides = React.useMemo(() => ({
    ...(baseline?.overrides ?? EMPTY_OVERRIDES),
    returnBps: whatIf.returnBps,
    contributionPause: whatIf.pauseMonths > 0 ? { months: whatIf.pauseMonths, startMonth } : null,
  }), [baseline, whatIf, startMonth]);
  const projection = React.useMemo(() => buildProjection(asHousehold(data), { startMonth, overrides, respGrants, investMonths: 361, horizonMonths: 361 }), [data, startMonth, overrides, respGrants]);

  // Roll-up groups: owner + type. Children roll into their parent; standalone accounts are their own group member.
  const groups = React.useMemo(() => {
    const byKey = new Map<string, { owner: Account["owner"]; type: Account["type"]; members: Account[] }>();
    for (const a of data.accounts) {
      if (a.parentId) continue; // rolled into parent
      const k = `${a.owner}:${a.type}`;
      const g = byKey.get(k) ?? { owner: a.owner, type: a.type, members: [] };
      g.members.push(a);
      byKey.set(k, g);
    }
    return [...byKey.values()].sort((x, y) => OWNERS.indexOf(x.owner) - OWNERS.indexOf(y.owner) || TYPES.indexOf(x.type) - TYPES.indexOf(y.type));
  }, [data.accounts]);
  const childrenOf = (id: string) => data.accounts.filter((a) => a.parentId === id);
  const leaves = (a: Account): Account[] => (childrenOf(a.id).length ? childrenOf(a.id) : [a]);
  const groupLeaves = (g: (typeof groups)[number]) => g.members.flatMap(leaves);
  const monthlyInto = (accountId: string) => data.contributions.filter((c) => c.accountId === accountId && c.source !== "LUMP_SUM").reduce((s, c) => s + toMonthlyCents(c.amountCents, c.frequency), 0);
  const daysSince = (isoDate: string) => Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  const balanceAt = (ids: string[], monthIdx: number) => ids.reduce((s, id) => s + (projection.invest.months[monthIdx]?.balances[id] ?? 0), 0);

  // Chart rows at yearly resolution (plus month 0)
  const horizon = years * 12;
  const groupKeys = groups.map((g) => ({ key: `${g.owner}:${g.type}`, name: `${personName(g.owner)} ${typeLabel[g.type]}`, ids: groupLeaves(g).map((a) => a.id) }));
  const rows = projection.invest.months.slice(0, horizon + 1).filter((_, i) => i % 12 === 0 || i === horizon).map((m, _, arr) => {
    const idx = projection.invest.months.indexOf(m);
    const row: Record<string, number | string> = { month: m.month, total: m.totalCents };
    for (const g of groupKeys) row[g.key] = balanceAt(g.ids, idx);
    void arr;
    return row;
  });
  const nwRows = projection.netWorth.slice(0, horizon + 1).filter((_, i) => i % 12 === 0 || i === horizon).map((n) => ({ month: n.month, nw: includeHome ? n.withHomeCents : n.cents }));


  // Contribution room: entered room − contributions to that owner's accounts of that type since the as-of date.
  const roomFor = (person: "ALEX" | "SELIA", type: "TFSA" | "RRSP") => {
    const r = rooms.find((x) => x.person === person && x.accountType === type);
    const ids = data.accounts.filter((a) => a.owner === person && a.type === type).map((a) => a.id);
    const nowKey = monthKey(new Date());
    let used = 0;
    if (r) {
      for (const c of data.contributions.filter((c) => ids.includes(c.accountId) && c.source !== "LUMP_SUM")) {
        const from = c.startDate > r.asOf ? c.startDate : r.asOf;
        const months = Math.max(0, monthDiff(from.slice(0, 7), nowKey));
        used += toMonthlyCents(c.amountCents, c.frequency) * months;
      }
    }
    const yearly = ids.reduce((s, id) => s + monthlyInto(id) * 12, 0);
    return { r, used, remaining: (r?.roomCents ?? 0) - used, yearly };
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t("invest.title")} subtitle={lang === "fr" ? "Ce que nous avons de côté, et où cela nous mène." : "What we have set aside, and where it takes us."}
        actions={<Button variant="soft" onClick={() => setAdding(true)}><Plus /> {lang === "fr" ? "Ajouter un compte" : "Add account"}</Button>} />

      {/* Accounts */}
      <Section icon={<Wallet />} title={lang === "fr" ? "Nos comptes" : "Our accounts"} hint={lang === "fr" ? `Touchez un compte pour mettre son solde à jour. Un solde de plus de ${STALE_DAYS} jours est marqué « à mettre à jour ».` : `Tap an account to update its balance. A balance older than ${STALE_DAYS} days is marked “update me”.`}>
        {groups.length === 0 ? <EmptyState>{lang === "fr" ? "Ajoutez vos comptes (REER, CELI, REEE, encaisse) avec leur solde et la date du solde." : "Add your accounts (RRSP, TFSA, RESP, cash) with their balance and the balance date."}</EmptyState> : groups.map((g) => {
          const k = `${g.owner}:${g.type}`;
          const ls = groupLeaves(g);
          const bal = ls.reduce((s, a) => s + a.balanceCents, 0);
          const oldest = ls.map((a) => a.balanceAsOf).sort()[0];
          const contrib = ls.reduce((s, a) => s + monthlyInto(a.id), 0);
          const isOpen = expanded[k] ?? false;
          const single = ls.length === 1 && g.members.length === 1;
          const stale = daysSince(oldest) > STALE_DAYS;
          const openEdit = (a: Account) => { setEditing(a); setEdit({ name: a.name, balanceCents: a.balanceCents, balanceAsOf: a.balanceAsOf, returnBps: a.returnBps, includeInNetWorth: a.includeInNetWorth, subType: a.subType }); };
          return (
            <React.Fragment key={k}>
              <ListRow
                className={single ? "" : "cursor-pointer"}
                primary={<span className="flex items-center gap-2">{personName(g.owner)} · {typeLabel[g.type]}{!single && <button type="button" aria-expanded={isOpen} className="text-xs text-primary font-medium" onClick={(e) => { e.stopPropagation(); setExpanded((x) => ({ ...x, [k]: !isOpen })); }}>{isOpen ? (lang === "fr" ? "replier" : "collapse") : `${ls.length} ${lang === "fr" ? "sous-comptes" : "sub-accounts"}`}</button>}</span>}
                secondary={<span className="flex items-center gap-1.5 flex-wrap">{t("common.asOf")} {oldest}{stale && <Badge variant="watch">{lang === "fr" ? "à mettre à jour" : "update me"}</Badge>}{contrib > 0 && <> · +{money(contrib, { compact: true })}{t("common.perMonth")}</>}{!ls.every((a) => a.includeInNetWorth) && <> · {lang === "fr" ? "hors valeur nette" : "not in net worth"}</>}</span>}
                value={money(bal)}
                valueSub={`${pct(bal > 0 ? Math.round(ls.reduce((s, a) => s + a.returnBps * a.balanceCents, 0) / bal) : ls[0]?.returnBps ?? 0, 1)} ${lang === "fr" ? "présumé" : "assumed"}`}
                onClick={single ? () => openEdit(ls[0]) : () => setExpanded((x) => ({ ...x, [k]: !isOpen }))}
              />
              {isOpen && !single && ls.map((a) => (
                <ListRow key={a.id} className="pl-5 bg-muted/30" primary={a.name} secondary={<>{a.subType ? `${a.subType} · ` : ""}{t("common.asOf")} {a.balanceAsOf}{daysSince(a.balanceAsOf) > STALE_DAYS && <> · <Badge variant="watch">{lang === "fr" ? "à mettre à jour" : "update me"}</Badge></>}{monthlyInto(a.id) > 0 && <> · +{money(monthlyInto(a.id), { compact: true })}{t("common.perMonth")}</>}</>}
                  value={money(a.balanceCents)} valueSub={`${pct(a.returnBps, 1)} ${lang === "fr" ? "présumé" : "assumed"}`} onClick={() => openEdit(a)} />
              ))}
            </React.Fragment>
          );
        })}
        <div className="flex items-center justify-between pt-3 text-sm"><span className="text-muted-foreground">{t("common.total")} · {lang === "fr" ? "cotisations" : "contributions"} {money(data.accounts.reduce((s, a) => s + monthlyInto(a.id), 0), { compact: true })}{t("common.perMonth")}</span><Money cents={data.accounts.filter((a) => !childrenOf(a.id).length).reduce((s, a) => s + a.balanceCents, 0)} className="font-semibold" /></div>
      </Section>

      {/* Edit account drawer */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={editing.name} description={`${personName(editing.owner)} · ${typeLabel[editing.type]}${editing.subType ? ` · ${editing.subType}` : ""}`}>
            <div className="space-y-4 text-sm flex-1 flex flex-col">
              <div className="space-y-1.5"><Label>{lang === "fr" ? "Solde actuel" : "Current balance"}</Label><Input inputMode="decimal" className="h-12 text-lg text-right tabular" defaultValue={((edit.balanceCents ?? 0) / 100).toFixed(2)} autoFocus onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) setEdit((x) => ({ ...x, balanceCents: c, balanceAsOf: today() })); }} /><p className="text-xs text-muted-foreground">{lang === "fr" ? "La date passe automatiquement à aujourd'hui." : "The as-of date becomes today automatically."}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>{t("common.asOf")}</Label><Input type="date" value={edit.balanceAsOf ?? ""} onChange={(e) => setEdit((x) => ({ ...x, balanceAsOf: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>{lang === "fr" ? "Rendement présumé (%)" : "Assumed return (%)"}</Label><Input inputMode="decimal" defaultValue={((edit.returnBps ?? 0) / 100).toFixed(1)} onBlur={(e) => { const p = Number(e.target.value.replace(",", ".")); if (Number.isFinite(p)) setEdit((x) => ({ ...x, returnBps: Math.round(p * 100) })); }} /></div>
              </div>
              <div className="space-y-1.5"><Label>{t("common.name")}</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} /></div>
              <label className="flex items-center justify-between rounded-xl border p-3"><span>{lang === "fr" ? "Compter dans la valeur nette" : "Count in net worth"}<span className="block text-xs text-muted-foreground">{lang === "fr" ? "Désactivez pour le REEE, par exemple." : "Turn off for the RESP, for example."}</span></span><Switch checked={edit.includeInNetWorth ?? true} onCheckedChange={(v) => setEdit((x) => ({ ...x, includeInNetWorth: v }))} /></label>
              <div className="flex items-center justify-between pt-3 mt-auto">
                <Button variant="ghost" className="text-act" disabled={pending} onClick={() => start(async () => { const r = await deleteAccount(editing.id); if (!r.ok) toast.error(r.error); else { setEditing(null); router.refresh(); } })}><TrashIcon /> {t("common.delete")}</Button>
                <Button size="lg" disabled={pending} onClick={() => start(async () => { const r = await updateAccount(editing.id, edit); if (!r.ok) toast.error(r.error); else { toast.success(t("common.saved")); setEditing(null); router.refresh(); } })}>{t("common.save")}</Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Projection */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>{lang === "fr" ? "Dans 5, 10, 20, 30 ans" : "In 5, 10, 20, 30 years"} <How>{lang === "fr" ? "Solde × (1 + r)^(1/12) chaque mois + cotisations en fin de mois. r = rendement annuel effectif du compte (ou l'hypothèse globale)." : "Balance × (1 + r)^(1/12) each month + end-of-month contributions. r = the account's effective annual return (or the global what-if)."}</How></CardTitle>
            <Tabs value={String(years)} onValueChange={(v) => setYears(Number(v) as 5 | 10 | 20 | 30)}>
              <TabsList>{[5, 10, 20, 30].map((y) => <TabsTrigger key={y} value={String(y)}>{y} {t("common.years")}</TabsTrigger>)}</TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            <LinesChart rows={rows} series={[{ key: "total", name: t("common.total"), color: "var(--foreground)" }, ...groupKeys.map((g, i) => ({ key: g.key, name: g.name, color: CHART_COLORS[i % CHART_COLORS.length] }))]} height={300} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[5, 10, 20, 30].map((y) => (
                <div key={y}><div className="text-xs text-muted-foreground">{y} {t("common.years")}</div><div className="font-semibold tabular">{money(projection.invest.months[Math.min(y * 12, projection.invest.months.length - 1)]?.totalCents ?? 0, { compact: true })}</div></div>
              ))}
            </div>
            {data.accounts.some((a) => a.type === "RESP") && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={respGrants} onCheckedChange={setRespGrants} /> {t("invest.respGrants")}
                <How>{`CESG 20 %: max ${money(CESG_ANNUAL_CAP_CENTS, { compact: true })}/yr, ${money(CESG_LIFETIME_CAP_CENTS, { compact: true })} lifetime · QESI 10 %: max ${money(QESI_ANNUAL_CAP_CENTS, { compact: true })}/yr, ${money(QESI_LIFETIME_CAP_CENTS, { compact: true })} lifetime. ${lang === "fr" ? "Report des droits inutilisés non modélisé." : "Carry-forward not modelled."}`}</How>
                {respGrants && projection.invest.totalGrantsCents > 0 && <span className="text-xs text-muted-foreground">· {money(projection.invest.totalGrantsCents, { compact: true })} {lang === "fr" ? "de subventions sur" : "in grants over"} {years} {t("common.years")}</span>}
              </label>
            )}
          </CardContent>
        </Card>

        {/* What-ifs */}
        <Card className="h-fit">
          <CardHeader><CardTitle>{lang === "fr" ? "Et si…" : "What if…"}</CardTitle><p className="text-sm text-muted-foreground">{lang === "fr" ? "Glissez pour voir la courbe changer." : "Drag to see the curve change."}</p></CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="space-y-2">
              <Label>{lang === "fr" ? "Rendement global" : "Global return"}: {whatIf.returnBps === null ? (lang === "fr" ? "par compte" : "per account") : pct(whatIf.returnBps, 1)}</Label>
              <Slider value={[whatIf.returnBps ?? data.settings.defaultReturnBps]} min={0} max={1200} step={25} onValueChange={(v) => setWhatIf((w) => ({ ...w, returnBps: v[0] }))} aria-label="Return" />
              {whatIf.returnBps !== null && <button className="text-xs underline text-muted-foreground" onClick={() => setWhatIf((w) => ({ ...w, returnBps: null }))}>{lang === "fr" ? "revenir aux rendements par compte" : "back to per-account returns"}</button>}
            </div>
            <div className="space-y-2">
              <Label>{lang === "fr" ? "Suspendre toutes les cotisations" : "Pause all contributions"}: {whatIf.pauseMonths} {t("common.months")}</Label>
              <Slider value={[whatIf.pauseMonths]} min={0} max={60} step={1} onValueChange={(v) => setWhatIf((w) => ({ ...w, pauseMonths: v[0] }))} aria-label="Pause months" />
            </div>
            {baseline && (whatIf.returnBps !== null || whatIf.pauseMonths > 0) && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
                const r = await saveScenario(null, { name: lang === "fr" ? `Et si placements ${new Date().toISOString().slice(0, 10)}` : `Investments what-if ${new Date().toISOString().slice(0, 10)}`, description: null, overrides });
                if (r.ok) { toast.success(t("common.saved")); router.push(`/payoff?scenario=${r.data.id}`); } else toast.error(r.error);
              })}>{lang === "fr" ? "Enregistrer comme scénario" : "Save as a scenario"}</Button>
            )}
            <div className="space-y-2 border-t pt-4">
              <Label>{lang === "fr" ? "Ajouter une cotisation mensuelle" : "Add a monthly contribution"} <How>{lang === "fr" ? "Crée une vraie ligne dans Budget › Épargne et placements ; le flux libre et le remboursement en tiennent compte." : "Creates a real line under Budget › Savings & investments; free cash flow and payoff reflect it."}</How></Label>
              <Select value={newContrib.accountId} onChange={(e) => setNewContrib({ ...newContrib, accountId: e.target.value })} aria-label="Account">
                <option value="">—</option>
                {data.accounts.filter((a) => !childrenOf(a.id).length).map((a) => <option key={a.id} value={a.id}>{personName(a.owner)} · {a.name}</option>)}
              </Select>
              <div className="flex gap-2">
                <Input className="h-8 text-right" inputMode="decimal" placeholder="$ / month" value={newContrib.amount} onChange={(e) => setNewContrib({ ...newContrib, amount: e.target.value })} aria-label={t("common.amount")} />
                <Button size="sm" disabled={pending || !newContrib.accountId || !parseMoney(newContrib.amount)} onClick={() => start(async () => {
                  const r = await createContribution({ accountId: newContrib.accountId, amountCents: parseMoney(newContrib.amount)!, frequency: "MONTHLY", source: "SPENDING_ACCOUNT", startDate: today(), notes: "Added from Investments" });
                  if (r.ok) { toast.success(t("common.saved")); setNewContrib({ accountId: "", amount: "" }); router.refresh(); } else toast.error(r.error);
                })}>{t("common.add")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contribution room + Net worth */}
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader><CardTitle>{t("invest.room")} <How>{lang === "fr" ? "Droits saisis à la date indiquée − cotisations mensuelles depuis cette date (lignes du Budget)." : "Room entered at the as-of date − monthly contributions since that date (Budget lines)."}</How></CardTitle><p className="text-sm text-muted-foreground">{lang === "fr" ? "Combien on peut encore cotiser." : "How much more we can contribute."}</p></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(["ALEX", "SELIA"] as const).flatMap((p) => (["TFSA", "RRSP"] as const).map((ty) => {
              const { r, used, remaining, yearly } = roomFor(p, ty);
              const save = (roomCents: number, asOf: string) => start(async () => { const x = await upsertContributionRoom({ person: p, accountType: ty, roomCents, asOf, notes: r?.notes ?? null }); if (!x.ok) toast.error(x.error); else router.refresh(); });
              const total = r?.roomCents ?? 0;
              return (
                <div key={`${p}${ty}`} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between"><span className="font-medium">{personName(p)} · {typeLabel[ty]}</span>{r?.notes?.toLowerCase().startsWith("estimate") && <Badge variant="watch">{t("common.estimate")}</Badge>}</div>
                  <div className="text-2xl font-semibold tabular"><Money cents={remaining} colour /></div>
                  <div className="text-xs text-muted-foreground">{lang === "fr" ? "restants" : "remaining"}{yearly > 0 && <> · {lang === "fr" ? "au rythme de" : "at"} {money(yearly, { compact: true })}/{lang === "fr" ? "an" : "yr"}</>}</div>
                  {total > 0 && <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((used / total) * 100))}%` }} /></div>}
                  <div className="grid grid-cols-2 gap-2 items-center text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">{lang === "fr" ? "droits" : "room"} <MoneyCell cents={total} onCommit={(v) => save(v, r?.asOf ?? today())} ariaLabel="Room" className="w-24 font-medium text-foreground" /></span>
                    <span className="flex items-center gap-1 justify-end whitespace-nowrap">{t("common.asOf")} <DateCell value={r?.asOf ?? null} onCommit={(v) => v && save(total, v)} className="w-auto text-foreground" /></span>
                  </div>
                </div>
              );
            }))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("dash.netWorth")} <How>{lang === "fr" ? "Placements inclus − marge − cartes − autres dettes. Avec la maison : + valeur estimée − solde hypothécaire." : "Included investments − LOC − cards − other debts. With home: + estimated value − mortgage balance."}</How></CardTitle>
            <label className="flex items-center gap-2 text-xs"><Switch checked={includeHome} onCheckedChange={setIncludeHome} /> {t("dash.includeHome")}</label>
          </CardHeader>
          <CardContent>
            <LinesChart rows={nwRows} series={[{ key: "nw", name: t("dash.netWorth"), color: "var(--chart-2)" }]} height={240} />
            <div className="text-sm mt-2">{lang === "fr" ? "Aujourd'hui" : "Today"}: <strong className="tabular">{money(includeHome ? projection.currentNetWorthWithHomeCents : projection.currentNetWorthCents, { compact: true })}</strong> · {years} {t("common.years")}: <strong className="tabular">{money(nwRows[nwRows.length - 1]?.nw ?? 0, { compact: true })}</strong></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title={lang === "fr" ? "Nouveau compte" : "New account"}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("common.owner")}</Label><Select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value as AccountInput["owner"] })}>{OWNERS.map((o) => <option key={o} value={o}>{personName(o)}</option>)}</Select></div>
              <div className="space-y-1"><Label>{t("common.type")}</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountInput["type"], returnBps: e.target.value === "CASH" ? 0 : form.returnBps })}>{TYPES.map((x) => <option key={x} value={x}>{typeLabel[x]}</option>)}</Select></div>
            </div>
            <div className="space-y-1"><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{lang === "fr" ? "Sous-type" : "Sub-type"}</Label><Input placeholder="group / spousal / individual" value={form.subType ?? ""} onChange={(e) => setForm({ ...form, subType: e.target.value || null })} /></div>
              <div className="space-y-1"><Label>{lang === "fr" ? "Regroupé sous" : "Roll up under"}</Label><Select value={form.parentId ?? ""} onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}><option value="">—</option>{data.accounts.filter((a) => !a.parentId && a.owner === form.owner && a.type === form.type).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t("common.balance")}</Label><Input inputMode="decimal" onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null) setForm({ ...form, balanceCents: c }); }} /></div>
              <div className="space-y-1"><Label>{t("common.asOf")}</Label><Input type="date" value={form.balanceAsOf} onChange={(e) => setForm({ ...form, balanceAsOf: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>{lang === "fr" ? "Rendement annuel (%)" : "Assumed annual return (%)"}</Label><Input inputMode="decimal" defaultValue={(form.returnBps / 100).toFixed(1)} onBlur={(e) => { const p = Number(e.target.value.replace(",", ".")); if (Number.isFinite(p)) setForm({ ...form, returnBps: Math.round(p * 100) }); }} /></div>
            <label className="flex items-center justify-between"><span>{lang === "fr" ? "Inclure dans la valeur nette" : "Include in net worth"}</span><Switch checked={form.includeInNetWorth} onCheckedChange={(v) => setForm({ ...form, includeInNetWorth: v })} /></label>
            <Button disabled={pending || !form.name} onClick={() => start(async () => { const r = await createAccount(form); if (r.ok) { toast.success(t("common.saved")); setAdding(false); router.refresh(); } else toast.error(r.error); })}>{t("common.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
