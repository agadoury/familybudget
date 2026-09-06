"use client";
import { useActionState } from "react";
import { createPassword, login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next, create }: { next?: string; create: boolean }) {
  const [state, action, pending] = useActionState(create ? createPassword : login, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div className="space-y-1.5">
        <Label htmlFor="password">{create ? "New password" : "Password"}</Label>
        <Input id="password" name="password" type="password" className="h-11 text-base" autoFocus autoComplete={create ? "new-password" : "current-password"} required minLength={create ? 8 : 1} />
      </div>
      {create && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repeat it</Label>
          <Input id="confirm" name="confirm" type="password" className="h-11 text-base" autoComplete="new-password" required minLength={8} />
        </div>
      )}
      {state?.error ? <p className="text-sm text-act" role="alert">{state.error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "…" : create ? "Create password and open the app" : "Sign in"}
      </Button>
    </form>
  );
}
