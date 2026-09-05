"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { Home, Wallet, TrendingDown, Sprout, ClipboardCheck, Settings, Moon, Sun, LogOut, Languages, Lightbulb } from "lucide-react";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";
import { setEditor, logout } from "@/lib/actions/auth";
import { setLanguage } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", key: "nav.dashboard", icon: Home },
  { href: "/budget", key: "nav.budget", icon: Wallet },
  { href: "/payoff", key: "nav.payoff", icon: TrendingDown },
  { href: "/insights", key: "nav.insights", icon: Lightbulb },
  { href: "/investments", key: "nav.investments", icon: Sprout },
  { href: "/checkin", key: "nav.checkin", icon: ClipboardCheck },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, editor, names, lang } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [, start] = useTransition();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const other = editor === "ALEX" ? "SELIA" : "ALEX";
  const switchEditor = () => start(async () => { await setEditor(other); router.refresh(); });

  const EditorPill = ({ compact }: { compact?: boolean }) => (
    <button
      type="button"
      onClick={switchEditor}
      title={`${t("editor.label")} ${names[editor]} — ${lang === "fr" ? "cliquer pour changer" : "click to switch"}`}
      className={cn("flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact && "text-xs pr-2")}
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full font-semibold text-primary-foreground", editor === "ALEX" ? "bg-primary" : "bg-chart-5")}>{names[editor].charAt(0)}</span>
      {!compact && <span className="text-muted-foreground">{t("editor.label")}</span>}
      <span className="font-medium">{names[editor]}</span>
    </button>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden md:flex flex-col border-r bg-card/60 backdrop-blur p-4 gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-4 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Wallet className="h-4.5 w-4.5" /></div>
          <div className="font-semibold leading-tight">{t("app.title")}</div>
        </div>
        {[...NAV, { href: "/settings", key: "nav.settings", icon: Settings } as const].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] hover:bg-accent transition-colors",
              active(n.href) ? "bg-primary-soft text-primary font-semibold" : "text-foreground/80",
            )}
          >
            <n.icon className="h-4.5 w-4.5" />
            {t(n.key)}
          </Link>
        ))}
        <div className="mt-auto space-y-3">
          <EditorPill />
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </Button>
            <Button variant="ghost" size="sm" className="h-10" onClick={() => start(async () => { await setLanguage(lang === "fr" ? "EN" : "FR"); router.refresh(); })}>
              <Languages /> {t("lang.toggle")}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={() => start(() => logout())}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between border-b bg-card/80 backdrop-blur px-3 py-2 sticky top-0 z-40">
          <span className="font-semibold">{t("app.title")}</span>
          <div className="flex items-center gap-1">
            <EditorPill compact />
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("theme.toggle")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("nav.settings")} asChild><Link href="/settings"><Settings className="h-4 w-4" /></Link></Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-[1240px] w-full mx-auto fade-in">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-card/95 backdrop-blur grid grid-cols-6 z-40 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("flex flex-col items-center gap-1 py-2 text-[10px]", active(n.href) ? "text-primary font-semibold" : "text-muted-foreground")}
            >
              <span className={cn("flex h-7 w-11 items-center justify-center rounded-full", active(n.href) && "bg-primary-soft")}><n.icon className="h-4.5 w-4.5" /></span>
              {t(n.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
