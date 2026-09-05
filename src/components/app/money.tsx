"use client";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

export function Money({
  cents,
  compact,
  sign,
  className,
  colour,
}: {
  cents: number;
  compact?: boolean;
  sign?: boolean;
  className?: string;
  /** Colour by sign: positive good, negative act. */
  colour?: boolean;
}) {
  const { money } = useApp();
  return (
    <span className={cn("tabular", colour && cents < 0 && "text-act", colour && cents > 0 && "text-good", className)}>
      {money(cents, { compact, sign })}
    </span>
  );
}
