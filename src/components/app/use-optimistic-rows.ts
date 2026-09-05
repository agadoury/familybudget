"use client";
import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/common";

/** Server actions can throw (network, 500): normalise to an ActionResult. */
async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}

/**
 * Local copy of server rows with optimistic patch / add / remove, an undo toast, and a
 * router.refresh() after each successful write so server-computed numbers catch up.
 */
export function useOptimisticRows<T extends { id: string }>(initial: T[], labels: { saved: string; deleted: string; undo: string }) {
  const [rows, setRows] = React.useState<T[]>(initial);
  const router = useRouter();
  React.useEffect(() => setRows(initial), [initial]);

  const patch = React.useCallback(
    async (id: string, changes: Partial<T>, action: (id: string, changes: Partial<T>) => Promise<ActionResult>, opts?: { silent?: boolean }) => {
      const before = rows.find((r) => r.id === id);
      if (!before) return;
      const prev: Partial<T> = {};
      for (const k of Object.keys(changes) as (keyof T)[]) prev[k] = before[k];
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
      const res = await run(() => action(id, changes));
      if (!res.ok) {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...prev } : r)));
        toast.error(res.error);
        return;
      }
      router.refresh();
      if (!opts?.silent)
        toast.success(labels.saved, {
          action: {
            label: labels.undo,
            onClick: async () => {
              setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...prev } : r)));
              const back = await run(() => action(id, prev));
              if (!back.ok) toast.error(back.error);
              router.refresh();
            },
          },
        });
    },
    [rows, router, labels],
  );

  const remove = React.useCallback(
    async (id: string, action: (id: string) => Promise<ActionResult>, recreate?: (row: T) => Promise<ActionResult<{ id: string }>>) => {
      const before = rows.find((r) => r.id === id);
      if (!before) return;
      setRows((rs) => rs.filter((r) => r.id !== id));
      const res = await run(() => action(id));
      if (!res.ok) {
        setRows((rs) => [...rs, before]);
        toast.error(res.error);
        return;
      }
      router.refresh();
      toast.success(labels.deleted, {
        action: recreate
          ? {
              label: labels.undo,
              onClick: async () => {
                const r = await run(() => recreate(before));
                if (!r.ok) toast.error(r.error);
                router.refresh();
              },
            }
          : undefined,
      });
    },
    [rows, router, labels],
  );

  const add = React.useCallback(
    async (temp: T, action: () => Promise<ActionResult<{ id: string }>>) => {
      setRows((rs) => [...rs, temp]);
      const res = await run(action);
      if (!res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== temp.id));
        toast.error(res.error);
        return null;
      }
      setRows((rs) => rs.map((r) => (r.id === temp.id ? { ...r, id: res.data.id } : r)));
      router.refresh();
      toast.success(labels.saved);
      return res.data.id;
    },
    [router, labels],
  );

  return { rows, setRows, patch, remove, add };
}
