"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getStrings, interpolate, type Lang, type StringKey } from "@/lib/i18n/strings";
import { formatMoney, formatPct } from "@/lib/money";
import { formatMonth, type MonthKey } from "@/lib/frequency";

interface AppContextValue {
  lang: Lang;
  locale: "fr-CA" | "en-CA";
  editor: "ALEX" | "SELIA";
  names: { ALEX: string; SELIA: string };
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  money: (cents: number, opts?: { compact?: boolean; sign?: boolean }) => string;
  pct: (bps: number, digits?: number) => string;
  month: (k: MonthKey) => string;
  personName: (p: "ALEX" | "SELIA" | "JOINT" | "SHARED" | null | undefined) => string;
}

const AppContext = React.createContext<AppContextValue | null>(null);

export function AppProviders({
  children,
  lang,
  editor,
  names,
}: {
  children: React.ReactNode;
  lang: Lang;
  editor: "ALEX" | "SELIA";
  names: { ALEX: string; SELIA: string };
}) {
  const value = React.useMemo<AppContextValue>(() => {
    const strings = getStrings(lang);
    const locale = lang === "fr" ? "fr-CA" : "en-CA";
    return {
      lang,
      locale,
      editor,
      names,
      t: (key, vars) => (vars ? interpolate(strings[key], vars) : strings[key]),
      money: (cents, opts) => formatMoney(cents, { locale, ...opts }),
      pct: (bps, digits) => formatPct(bps, locale, digits),
      month: (k) => formatMonth(k, locale),
      personName: (p) =>
        p === "ALEX" ? names.ALEX : p === "SELIA" ? names.SELIA : p === "JOINT" ? (lang === "fr" ? "Conjoint" : "Joint") : lang === "fr" ? "Commun" : "Shared",
    };
  }, [lang, editor, names]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppContext.Provider value={value}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="bottom-center" richColors closeButton />
      </AppContext.Provider>
    </ThemeProvider>
  );
}

export function useApp(): AppContextValue {
  const v = React.useContext(AppContext);
  if (!v) throw new Error("useApp outside AppProviders");
  return v;
}

export const useT = () => useApp().t;
