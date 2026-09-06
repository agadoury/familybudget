"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { useApp } from "@/components/app/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { parseMoney } from "@/lib/money";
import { resetDemoData, updateSettings } from "@/lib/actions/settings";
import { importBudgetCsv } from "@/lib/actions/csv";
import { changePassword } from "@/lib/actions/auth";

function PasswordForm() {
  const { lang } = useApp();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end text-sm" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await changePassword({ current, next }); if (r.ok) { toast.success(lang === "fr" ? "Mot de passe changé — tout le monde devra se reconnecter." : "Password changed — everyone signs in again."); setCurrent(""); setNext(""); } else toast.error(r.error); }); }}>
      <div className="space-y-1"><Label>{lang === "fr" ? "Actuel" : "Current"}</Label><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div className="space-y-1"><Label>{lang === "fr" ? "Nouveau (8+ caractères)" : "New (8+ characters)"}</Label><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <Button type="submit" disabled={pending || !current || next.length < 8}>{lang === "fr" ? "Changer" : "Change"}</Button>
    </form>
  );
}

type S = { alexName: string; seliaName: string; language: "EN" | "FR"; defaultScenarioId: string | null; defaultReturnBps: number; homeValueCents: number; cashBufferCents: number; includeHomeEquity: boolean; alexGrossIncomeCents: number; seliaGrossIncomeCents: number };

export function SettingsClient({ settings, scenarios }: { settings: S; scenarios: { id: string; name: string }[] }) {
  const { t, lang } = useApp();
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [pending, start] = React.useTransition();
  const [confirmReset, setConfirmReset] = React.useState(false);
  const save = (patch: Partial<S>) => {
    setS((x) => ({ ...x, ...patch }));
    start(async () => { const r = await updateSettings(patch); if (!r.ok) toast.error(r.error); else { toast.success(t("common.saved")); router.refresh(); } });
  };
  async function onImport(file: File) {
    const res = await importBudgetCsv(await file.text());
    if (res.ok) { toast.success(`${res.data.created} created, ${res.data.updated} updated`); router.refresh(); } else toast.error(res.error);
  }
  const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => <div className="space-y-1"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title={t("settings.title")} subtitle={lang === "fr" ? "Noms, langue, hypothèses et données." : "Names, language, assumptions and data."} />
      <Card><CardHeader><CardTitle>{lang === "fr" ? "Ménage" : "Household"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <F label={lang === "fr" ? "Nom 1" : "Name 1"}><Input defaultValue={s.alexName} onBlur={(e) => e.target.value !== s.alexName && save({ alexName: e.target.value })} /></F>
          <F label={lang === "fr" ? "Nom 2" : "Name 2"}><Input defaultValue={s.seliaName} onBlur={(e) => e.target.value !== s.seliaName && save({ seliaName: e.target.value })} /></F>
          <F label={lang === "fr" ? "Langue" : "Language"}><Select value={s.language} onChange={(e) => save({ language: e.target.value as "EN" | "FR" })}><option value="EN">English</option><option value="FR">Français</option></Select></F>
          <F label={lang === "fr" ? "Scénario par défaut" : "Default scenario"} hint={lang === "fr" ? "Utilisé par le tableau de bord." : "Used by the dashboard."}><Select value={s.defaultScenarioId ?? ""} onChange={(e) => save({ defaultScenarioId: e.target.value || null })}><option value="">—</option>{scenarios.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{lang === "fr" ? "Mot de passe du ménage" : "Household password"}</CardTitle></CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{lang === "fr" ? "Hypothèses" : "Assumptions"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <F label={lang === "fr" ? "Rendement par défaut (%)" : "Default return assumption (%)"} hint={lang === "fr" ? "Appliqué aux nouveaux comptes." : "Applied to new accounts."}><Input inputMode="decimal" defaultValue={(s.defaultReturnBps / 100).toFixed(1)} onBlur={(e) => { const p = Number(e.target.value.replace(",", ".")); if (Number.isFinite(p) && Math.round(p * 100) !== s.defaultReturnBps) save({ defaultReturnBps: Math.round(p * 100) }); }} /></F>
          <F label={lang === "fr" ? "Valeur estimée de la maison" : "Estimated home value"} hint={lang === "fr" ? "Pour le bouton « inclure la maison » de la valeur nette." : "For the net-worth home-equity toggle."}><Input inputMode="decimal" defaultValue={(s.homeValueCents / 100).toFixed(0)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== s.homeValueCents) save({ homeValueCents: c }); }} /></F>
          <F label={lang === "fr" ? "Tampon d'encaisse minimal" : "Minimum cash buffer"} hint={lang === "fr" ? "Les scénarios n'envoient jamais l'encaisse sous ce montant à la dette." : "Scenarios never send cash below this to debt."}><Input inputMode="decimal" defaultValue={(s.cashBufferCents / 100).toFixed(0)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== s.cashBufferCents) save({ cashBufferCents: c }); }} /></F>
          <label className="flex items-center justify-between gap-2 self-end pb-2"><span>{lang === "fr" ? "Inclure la maison par défaut" : "Include home equity by default"}</span><Switch checked={s.includeHomeEquity} onCheckedChange={(v) => save({ includeHomeEquity: v })} /></label>
          <F label={`${lang === "fr" ? "Salaire brut annuel" : "Gross annual salary"} — ${s.alexName}`} hint={lang === "fr" ? "Sert uniquement à estimer le taux marginal d'imposition pour les conseils REER vs dette." : "Used only to estimate the marginal tax rate for RRSP-vs-debt advice."}><Input inputMode="decimal" defaultValue={(s.alexGrossIncomeCents / 100).toFixed(0)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== s.alexGrossIncomeCents) save({ alexGrossIncomeCents: c }); }} /></F>
          <F label={`${lang === "fr" ? "Salaire brut annuel" : "Gross annual salary"} — ${s.seliaName}`}><Input inputMode="decimal" defaultValue={(s.seliaGrossIncomeCents / 100).toFixed(0)} onBlur={(e) => { const c = parseMoney(e.target.value); if (c !== null && c !== s.seliaGrossIncomeCents) save({ seliaGrossIncomeCents: c }); }} /></F>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{lang === "fr" ? "Données" : "Data"}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Button variant="outline" asChild><a href="/api/budget/csv" download><Download /> {t("budget.exportCsv")}</a></Button>
          <label className="inline-flex"><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} /><span className="inline-flex items-center gap-2 h-9 px-4 rounded-md border text-sm font-medium cursor-pointer hover:bg-accent"><Upload className="h-4 w-4" /> {t("budget.importCsv")}</span></label>
          {!confirmReset ? (
            <Button variant="ghost" className="text-act" onClick={() => setConfirmReset(true)}>{lang === "fr" ? "Réinitialiser avec les données de démo" : "Reset demo data"}</Button>
          ) : (
            <span className="flex items-center gap-2 rounded-md bg-act-bg p-2 text-act">
              {lang === "fr" ? "Ceci efface TOUT et charge les données de démo." : "This wipes EVERYTHING and loads the demo data."}
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => { const r = await resetDemoData(); if (r.ok) { toast.success("Demo data loaded"); setConfirmReset(false); router.refresh(); } else toast.error(r.error); })}>{lang === "fr" ? "Confirmer" : "Confirm"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>{t("common.cancel")}</Button>
            </span>
          )}
        </CardContent></Card>
    </div>
  );
}
