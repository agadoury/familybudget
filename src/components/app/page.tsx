"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Page title with a one-line, plain-words subtitle and optional actions. */
export function PageHeader({ title, subtitle, actions, className }: { title: string; subtitle?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A card-based section: icon, title, hint sentence, optional action on the right. */
export function Section({ icon, title, hint, action, children, className, tone }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; tone?: "default" | "act" | "good" }) {
  return (
    <Card className={cn(tone === "act" && "border-act/40", tone === "good" && "border-good/40", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:h-4.5 [&_svg]:w-4.5">{icon}</div>}
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold leading-tight">{title}</h2>
            {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

/**
 * A list row: primary text, small secondary line, a value on the right, optional chevron.
 * Pass `mobilePrimary` / `mobileValue` (plain text) to replace inline inputs on phones;
 * the whole row then opens the drawer on tap, while desktop keeps inline editing + chevron.
 */
export function ListRow({ primary, secondary, value, valueSub, right, onClick, className, muted, mobilePrimary, mobileValue }: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  value?: React.ReactNode;
  valueSub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  muted?: boolean;
  mobilePrimary?: React.ReactNode;
  mobileValue?: React.ReactNode;
}) {
  const rowClick = onClick
    ? (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("input,select,button,a,textarea,label")) return;
        onClick();
      }
    : undefined;
  const swap = (desktop: React.ReactNode, mobile: React.ReactNode | undefined) =>
    mobile === undefined ? desktop : (
      <>
        <span className="sm:hidden">{mobile}</span>
        <span className="hidden sm:block">{desktop}</span>
      </>
    );
  return (
    <div
      className={cn("flex items-center gap-3 py-2.5 border-b last:border-0 min-h-14", muted && "opacity-70", onClick && "cursor-pointer sm:cursor-default hover:bg-muted/40 -mx-2 px-2 rounded-lg", className)}
      onClick={rowClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); } : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-tight truncate">{swap(primary, mobilePrimary)}</div>
        {secondary && <div className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</div>}
      </div>
      {(value !== undefined || valueSub) && (
        <div className="text-right shrink-0 max-w-[45%]">
          {value !== undefined && <div className="font-semibold tabular leading-tight flex justify-end">{swap(value, mobileValue)}</div>}
          {valueSub && <div className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{valueSub}</div>}
        </div>
      )}
      {right}
      {onClick && (
        <span aria-hidden className="hidden sm:flex ml-1 h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      )}
    </div>
  );
}

/** Big friendly number with a label and an optional sentence. */
export function BigStat({ label, value, sub, tone, icon, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "watch" | "act"; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className={cn("text-3xl md:text-4xl font-semibold tabular tracking-tight leading-none", tone === "good" && "text-good", tone === "act" && "text-act", tone === "watch" && "text-watch")}>{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Coloured callout with an icon; never colour alone. */
export function Callout({ tone, icon, children, className }: { tone: "good" | "watch" | "act" | "info"; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const cls = { good: "bg-good-bg text-good", watch: "bg-watch-bg text-watch", act: "bg-act-bg text-act", info: "bg-primary-soft text-primary" }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl p-3 text-sm leading-snug", cls, className)}>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground space-y-3">
      <p>{children}</p>
      {action}
    </div>
  );
}
