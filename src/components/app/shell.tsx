"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { LayoutDashboard, Table2, TrendingDown, LineChart, ClipboardCheck, Settings, Moon, Sun, LogOut } from "lucide-react";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";
import { setEditor, logout } from "@/lib/actions/auth";
import { setLanguage } from "@/lib/actions/settings";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/budget", key: "nav.budget", icon: Table2 },
  { href: "/payoff", key: "nav.payoff", icon: TrendingDown },
  { href: "/investments", key: "nav.investments", icon: LineChart },
  { href: "/checkin", key: "nav.checkin", icon: ClipboardCheck },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, editor, names, lang } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [, start] = useTransition();

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden md:flex flex-col border-r bg-card p-4 gap-1 sticky top-0 h-screen">
        <div className="text-base font-semibold px-2 mb-3">{t("app.title")}</div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
              active(n.href) && "bg-accent font-medium",
            )}
          >
            <n.icon className="h-4 w-4" />
            {t(n.key)}
          </Link>
        ))}
        <div className="mt-auto space-y-2">
          <label className="block text-xs text-muted-foreground px-2">{t("editor.label")}</label>
          <Select
            value={editor}
            onChange={(e) => start(async () => { await setEditor(e.target.value as "ALEX" | "SELIA"); router.refresh(); })}
            aria-label={t("editor.label")}
          >
            <option value="ALEX">{names.ALEX}</option>
            <option value="SELIA">{names.SELIA}</option>
          </Select>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => start(async () => { await setLanguage(lang === "fr" ? "EN" : "FR"); router.refresh(); })}>
              {t("lang.toggle")}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={() => start(() => logout())}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between border-b bg-card px-3 py-2 sticky top-0 z-40">
          <span className="font-semibold text-sm">{t("app.title")}</span>
          <div className="flex items-center gap-1">
            <Select
              className="h-8 w-auto text-xs"
              value={editor}
              onChange={(e) => start(async () => { await setEditor(e.target.value as "ALEX" | "SELIA"); router.refresh(); })}
              aria-label={t("editor.label")}
            >
              <option value="ALEX">{names.ALEX}</option>
              <option value="SELIA">{names.SELIA}</option>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("theme.toggle")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 max-w-[1400px] w-full mx-auto">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-card grid grid-cols-6 z-40">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", active(n.href) ? "text-foreground font-medium" : "text-muted-foreground")}
            >
              <n.icon className="h-4 w-4" />
              {t(n.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
