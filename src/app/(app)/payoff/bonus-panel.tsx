"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApp } from "@/components/app/providers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { parseMoney } from "@/lib/money";
import type { HouseholdDTO } from "@/lib/dto-household";
import { confirmBonus, upsertBonus } from "@/lib/actions/scenarios";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function BonusPanel({ data }: { data: HouseholdDTO }) {
  const { money, lang, personName, locale } = useApp();
  const router = useRouter();
  const year = new Date().getUTCFullYear();
  const rows = (["ALEX", "SELIA"] as const).map((p) => data.bonuses.find((b) => b.person === p && b.confidence === "UNCONFIRMED") ?? { id: null, person: p, amountCents: 0, expectedYear: year, expectedMonth: 12, confidence: "UNCONFIRMED" as const, pctAppliedBps: 10_000, debtPaymentId: null });
  const confirmed = data.bonuses.filter((b) => b.confidence === "CONFIRMED");
  const [confirming, setConfirming] = React.useState<(typeof rows)[number] | null>(null);
  const [confirmDebt, setConfirmDebt] = React.useState(data.debts.find((d) => d.includeInPayoff)?.id ?? "");
  const [confirmDate, setConfirmDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [confirmAmount, setConfirmAmount] = React.useState("");
  const monthName = (m: number) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1)));

  async function save(row: (typeof rows)[number], patch: Partial<(typeof rows)[number]>) {
    const next = { ...row, ...patch };
    const res = await upsertBonus(row.id, { person: next.person, amountCents: next.amountCents, expectedYear: next.expectedYear, expectedMonth: next.expectedMonth, confidence: "UNCONFIRMED", pctAppliedBps: next.pctAppliedBps });
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4 text-sm">
        <p className="text-muted-foreground">{lang === "fr" ? "Les bonis non confirmés apparaissent en pointillé sur le graphique et dans une deuxième ligne du résumé, jamais dans la référence ni dans plan vs réel. Confirmer un boni crée un vrai paiement forfaitaire." : "Unconfirmed bonuses show as a dotted overlay on the chart and a second summary line, never in the baseline or plan-vs-actual. Confirming one creates a real lump-sum payment."}</p>
        {rows.map((r) => (
          <div key={r.person} className="grid gap-2 md:grid-cols-[8rem_9rem_10rem_1fr_auto] items-center border rounded-md p-3">
            <div className="font-medium">{personName(r.person)} {lang === "fr" ? "boni" : "bonus"}</div>
            <Input className="h-8 text-right tabular" inputMode="decimal" defaultValue={(r.amountCents / 100).toFixed(2)} aria-label="Amount" onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== r.amountCents) save(r, { amountCents: c }); }} />
            <div className="flex gap-1">
              <Select className="h-8" value={r.expectedMonth} onChange={(e) => save(r, { expectedMonth: Number(e.target.value) })} aria-label="Month">{MONTHS.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</Select>
              <Select className="h-8 w-24" value={r.expectedYear} onChange={(e) => save(r, { expectedYear: Number(e.target.value) })} aria-label="Year">{[year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}</Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28">{lang === "fr" ? "% appliqué à la dette" : "% applied to debt"}: {(r.pctAppliedBps / 100).toFixed(0)} %</span>
              <Slider className="flex-1" value={[r.pctAppliedBps]} min={0} max={10_000} step={500} onValueCommit={(v) => save(r, { pctAppliedBps: v[0] })} aria-label="Percent applied" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="watch">{lang === "fr" ? "non confirmé" : "unconfirmed"}</Badge>
              <Button size="sm" variant="outline" disabled={r.amountCents <= 0 || !r.id} onClick={() => { setConfirming(r); setConfirmAmount((r.amountCents / 100).toFixed(2)); }}>{lang === "fr" ? "Reçu → confirmer" : "Received → confirm"}</Button>
            </div>
          </div>
        ))}
        {confirmed.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {lang === "fr" ? "Confirmés : " : "Confirmed: "}
            {confirmed.map((b) => `${personName(b.person)} ${money(b.amountCents)} (${monthName(b.expectedMonth)} ${b.expectedYear})`).join(" · ")}
          </div>
        )}
        <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
          <DialogContent title={lang === "fr" ? "Confirmer le boni" : "Confirm bonus"} description={lang === "fr" ? "Crée un paiement forfaitaire réel et réancre la projection." : "Creates a real lump-sum payment and re-anchors the projection."}>
            <div className="space-y-3 text-sm">
              <div className="space-y-1"><Label>{lang === "fr" ? "Montant net reçu" : "Net amount received"}</Label><Input inputMode="decimal" value={confirmAmount} onChange={(e) => setConfirmAmount(e.target.value)} /></div>
              <div className="space-y-1"><Label>{lang === "fr" ? "Appliqué sur" : "Applied to"}</Label><Select value={confirmDebt} onChange={(e) => setConfirmDebt(e.target.value)}>{data.debts.filter((d) => d.includeInPayoff).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
              <div className="space-y-1"><Label>{lang === "fr" ? "Date" : "Date"}</Label><Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} /></div>
              {confirming && <p className="text-xs text-muted-foreground">{lang === "fr" ? `${(confirming.pctAppliedBps / 100).toFixed(0)} % du montant sera payé sur la dette.` : `${(confirming.pctAppliedBps / 100).toFixed(0)} % of the amount will be paid on the debt.`}</p>}
              <Button onClick={async () => {
                if (!confirming?.id) return;
                const c = parseMoney(confirmAmount);
                const res = await confirmBonus(confirming.id, confirmDebt, confirmDate, c ?? undefined);
                if (res.ok) { toast.success(lang === "fr" ? "Boni confirmé" : "Bonus confirmed"); setConfirming(null); router.refresh(); } else toast.error(res.error);
              }}>{lang === "fr" ? "Confirmer" : "Confirm"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
