"use client";
import * as React from "react";
import { parseMoney } from "@/lib/money";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

/**
 * Inline cells: always-rendered inputs styled as text, so the whole table is Tab-navigable.
 * Enter or blur commits when the value changed; Escape reverts.
 */
export function TextCell({
  value,
  onCommit,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  const commit = () => {
    const t = v.trim();
    if (t !== value && t.length > 0) onCommit(t);
    else setV(value);
  };
  return (
    <input
      className={cn("cell-input", className)}
      value={v}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value);
      }}
    />
  );
}

export function MoneyCell({
  cents,
  onCommit,
  className,
  ariaLabel,
  allowZero = true,
}: {
  cents: number;
  onCommit: (cents: number) => void;
  className?: string;
  ariaLabel?: string;
  allowZero?: boolean;
}) {
  const { locale } = useApp();
  const fmt = React.useCallback(
    (c: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100),
    [locale],
  );
  const [v, setV] = React.useState(fmt(cents));
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (!editing) setV(fmt(cents));
  }, [cents, fmt, editing]);
  const commit = () => {
    setEditing(false);
    const parsed = parseMoney(v);
    if (parsed === null || parsed < 0 || (!allowZero && parsed === 0)) {
      setV(fmt(cents));
      return;
    }
    if (parsed !== cents) onCommit(parsed);
    else setV(fmt(cents));
  };
  return (
    <input
      className={cn("cell-input text-right tabular", className)}
      inputMode="decimal"
      value={v}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setEditing(true);
        e.target.select();
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(fmt(cents));
          setEditing(false);
        }
      }}
    />
  );
}

export function SelectCell<T extends string>({
  value,
  options,
  onCommit,
  className,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onCommit: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      className={cn("cell-input appearance-none cursor-pointer", className)}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onCommit(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckCell({ checked, onCommit, ariaLabel }: { checked: boolean; onCommit: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[var(--primary)] cursor-pointer"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onCommit(e.target.checked)}
    />
  );
}

export function DateCell({ value, onCommit, ariaLabel, className }: { value: string | null; onCommit: (v: string | null) => void; ariaLabel?: string; className?: string }) {
  return (
    <input
      type="date"
      className={cn("cell-input", className)}
      value={value ?? ""}
      aria-label={ariaLabel}
      onChange={(e) => onCommit(e.target.value || null)}
    />
  );
}
