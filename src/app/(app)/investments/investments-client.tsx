"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { How } from "@/components/app/how";
import { Money } from "@/components/app/money";
import { MoneyCell, TextCell, CheckCell, DateCell } from "@/components/app/inline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const patchAccount = (id: string, patch: Partial<AccountInput>) => start(async () => { const r = await updateAccount(id, patch); if (!r.ok) toast.error(r.error); else { toast.success(t("common.saved")); router.refresh(); } });

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("invest.title")}</h1>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus /> {lang === "fr" ? "Ajouter un compte" : "Add account"}</Button>
      </div>

      {/* Accounts table */}
      <Card>
        <CardContent className="pt-4">
          {groups.length === 0 ? <p className="text-sm text-muted-foreground border border-dashed rounded p-4">{lang === "fr" ? "Ajoutez vos comptes (REER, CELI, REEE, encaisse) avec leur solde et la date du solde." : "Add your accounts (RRSP, TFSA, RESP, cash) with their balance and the balance date."}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead /><TableHead>{lang === "fr" ? "Compte" : "Account"}</TableHead><TableHead className="text-right">{t("common.balance")}</TableHead><TableHead>{t("common.asOf")}</TableHead><TableHead className="text-right">{lang === "fr" ? "Rendement" : "Return"}</TableHead><TableHead className="text-right">{lang === "fr" ? "Cotisations/mois" : "Contributions/month"}</TableHead><TableHead className="text-center">{lang === "fr" ? "Valeur nette" : "Net worth"}</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const k = `${g.owner}:${g.type}`;
                  const ls = groupLeaves(g);
                  const bal = ls.reduce((s, a) => s + a.balanceCents, 0);
                  const oldest = ls.map((a) => a.balanceAsOf).sort()[0];
                  const contrib = ls.reduce((s, a) => s + monthlyInto(a.id), 0);
                  const wRet = bal > 0 ? Math.round(ls.reduce((s, a) => s + a.returnBps * a.balanceCents, 0) / bal) : ls[0]?.returnBps ?? 0;
                  const isOpen = expanded[k] ?? false;
                  const single = ls.length === 1 && g.members.length === 1;
                  return (
                    <React.Fragment key={k}>
                      <TableRow className="font-medium bg-muted/30">
                        <TableCell className="w-8">{!single && <button aria-expanded={isOpen} aria-label="Expand" onClick={() => setExpanded((e) => ({ ...e, [k]: !isOpen }))}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>}</TableCell>
                        <TableCell>{personName(g.owner)} · {typeLabel[g.type]} {!single && <span className="text-xs text-muted-foreground">({ls.length})</span>}</TableCell>
                        <TableCell className="text-right">{single ? <MoneyCell cents={ls[0].balanceCents} onCommit={(v) => patchAccount(ls[0].id, { balanceCents: v })} ariaLabel={t("common.balance")} /> : <Money cents={bal} />}</TableCell>
                        <TableCell className="text-xs">{single ? <DateCell value={ls[0].balanceAsOf} onCommit={(v) => v && patchAccount(ls[0].id, { balanceAsOf: v })} /> : oldest} {daysSince(oldest) > STALE_DAYS && <Badge variant="watch">{t("common.stale")} · {daysSince(oldest)} d</Badge>}</TableCell>
                        <TableCell className="text-right">{single ? <PctCell bps={ls[0].returnBps} onCommit={(v) => patchAccount(ls[0].id, { returnBps: v })} /> : pct(wRet, 1)}</TableCell>
                        <TableCell className="text-right"><Money cents={contrib} /></TableCell>
                        <TableCell className="text-center">{single ? <CheckCell checked={ls[0].includeInNetWorth} onCommit={(v) => patchAccount(ls[0].id, { includeInNetWorth: v })} /> : ls.every((a) => a.includeInNetWorth) ? "✓" : ls.some((a) => a.includeInNetWorth) ? "~" : "—"}</TableCell>
                        <TableCell className="w-10">{single && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-act" aria-label={t("common.delete")} onClick={() => start(async () => { const r = await deleteAccount(ls[0].id); if (!r.ok) toast.error(r.error); else router.refresh(); })}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
                      </TableRow>
                      {isOpen && !single && ls.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell />
                          <TableCell className="pl-6"><TextCell value={a.name} onCommit={(v) => patchAccount(a.id, { name: v })} ariaLabel={t("common.name")} /><span className="text-xs text-muted-foreground pl-2">{a.subType}</span></TableCell>
                          <TableCell className="text-right"><MoneyCell cents={a.balanceCents} onCommit={(v) => patchAccount(a.id, { balanceCents: v })} ariaLabel={t("common.balance")} /></TableCell>
                          <TableCell className="text-xs"><DateCell value={a.balanceAsOf} onCommit={(v) => v && patchAccount(a.id, { balanceAsOf: v })} /> {daysSince(a.balanceAsOf) > STALE_DAYS && <Badge variant="watch">{t("common.stale")}</Badge>}</TableCell>
                          <TableCell className="text-right"><PctCell bps={a.returnBps} onCommit={(v) => patchAccount(a.id, { returnBps: v })} /></TableCell>
                          <TableCell className="text-right"><Money cents={monthlyInto(a.id)} /></TableCell>
                          <TableCell className="text-center"><CheckCell checked={a.includeInNetWorth} onCommit={(v) => patchAccount(a.id, { includeInNetWorth: v })} /></TableCell>
                          <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-act" aria-label={t("common.delete")} onClick={() => start(async () => { const r = await deleteAccount(a.id); if (!r.ok) toast.error(r.error); else router.refresh(); })}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
                <TableRow className="font-semibold">
                  <TableCell /><TableCell>{t("common.total")}</TableCell>
                  <TableCell className="text-right"><Money cents={data.accounts.filter((a) => !childrenOf(a.id).length).reduce((s, a) => s + a.balanceCents, 0)} /></TableCell>
                  <TableCell /><TableCell /><TableCell className="text-right"><Money cents={data.accounts.reduce((s, a) => s + monthlyInto(a.id), 0)} /></TableCell><TableCell /><TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-2">{lang === "fr" ? `Soldes non mis à jour depuis ${STALE_DAYS}+ jours marqués « périmé ». Modifier un solde met la date à aujourd'hui.` : `Balances not updated in ${STALE_DAYS}+ days are marked stale. Editing a balance stamps today's date.`}</p>
        </CardContent>
      </Card>

      {/* Projection */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>{t("invest.projection")} <How>{lang === "fr" ? "Solde × (1 + r)^(1/12) chaque mois + cotisations en fin de mois. r = rendement annuel effectif du compte (ou l'hypothèse globale)." : "Balance × (1 + r)^(1/12) each month + end-of-month contributions. r = the account's effective annual return (or the global what-if)."}</How></CardTitle>
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
          <CardHeader><CardTitle>{lang === "fr" ? "Et si…" : "What if…"}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>{t("invest.room")} <How>{lang === "fr" ? "Droits saisis à la date indiquée − cotisations mensuelles depuis cette date (lignes du Budget)." : "Room entered at the as-of date − monthly contributions since that date (Budget lines)."}</How></CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead /><TableHead className="text-right">{lang === "fr" ? "Droits (saisis)" : "Room (entered)"}</TableHead><TableHead>{t("common.asOf")}</TableHead><TableHead className="text-right">{lang === "fr" ? "Utilisés depuis" : "Used since"}</TableHead><TableHead className="text-right">{lang === "fr" ? "Restants" : "Remaining"}</TableHead><TableHead className="text-right">{lang === "fr" ? "Rythme/an" : "Pace/yr"}</TableHead></TableRow></TableHeader>
              <TableBody>
                {(["ALEX", "SELIA"] as const).flatMap((p) => (["TFSA", "RRSP"] as const).map((ty) => {
                  const { r, used, remaining, yearly } = roomFor(p, ty);
                  const save = (roomCents: number, asOf: string) => start(async () => { const x = await upsertContributionRoom({ person: p, accountType: ty, roomCents, asOf, notes: r?.notes ?? null }); if (!x.ok) toast.error(x.error); else router.refresh(); });
                  return (
                    <TableRow key={`${p}${ty}`}>
                      <TableCell className="font-medium">{personName(p)} {typeLabel[ty]} {r?.notes?.toLowerCase().startsWith("estimate") && <Badge variant="watch">{t("common.estimate")}</Badge>}</TableCell>
                      <TableCell className="text-right min-w-32"><MoneyCell cents={r?.roomCents ?? 0} onCommit={(v) => save(v, r?.asOf ?? today())} ariaLabel="Room" /></TableCell>
                      <TableCell className="min-w-36"><DateCell value={r?.asOf ?? null} onCommit={(v) => v && save(r?.roomCents ?? 0, v)} /></TableCell>
                      <TableCell className="text-right"><Money cents={used} /></TableCell>
                      <TableCell className="text-right font-semibold"><Money cents={remaining} colour /></TableCell>
                      <TableCell className="text-right text-muted-foreground"><Money cents={yearly} compact /></TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
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

function PctCell({ bps, onCommit }: { bps: number; onCommit: (bps: number) => void }) {
  const [v, setV] = React.useState((bps / 100).toFixed(1));
  React.useEffect(() => setV((bps / 100).toFixed(1)), [bps]);
  return (
    <input
      className="cell-input text-right tabular w-20"
      inputMode="decimal"
      value={v}
      aria-label="Return"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const p = Number(v.replace(",", ".")); if (Number.isFinite(p) && Math.round(p * 100) !== bps) onCommit(Math.round(p * 100)); else setV((bps / 100).toFixed(1)); }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
