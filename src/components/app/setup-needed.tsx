/** Shown instead of the app when the deployment is not configured yet. Server component. */
export function SetupNeeded({ missing, dbError }: { missing: string[]; dbError?: string | null }) {
  const steps: { key: string; title: string; how: string }[] = [
    { key: "DATABASE_URL", title: "Add the database", how: "In the Vercel project open Storage → Create Database → Postgres → Connect. Vercel fills in DATABASE_URL automatically." },
    { key: "HOUSEHOLD_PASSWORD", title: "Set the household password", how: "Vercel project → Settings → Environment Variables → add HOUSEHOLD_PASSWORD with the password you will both use." },
    { key: "SESSION_SECRET", title: "Set a session secret", how: "Same place: add SESSION_SECRET with any long random string (32+ characters)." },
  ];
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Almost there</h1>
          <p className="text-muted-foreground mt-1">The app is deployed but not configured yet. Finish these steps, then redeploy (Deployments → ⋯ → Redeploy).</p>
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const done = !missing.includes(s.key) && !(s.key === "DATABASE_URL" && dbError);
            return (
              <li key={s.key} className={`flex gap-3 rounded-xl border p-3 ${done ? "opacity-60" : ""}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-good-bg text-good" : "bg-primary text-primary-foreground"}`}>{done ? "✓" : i + 1}</span>
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.how}</div>
                  {s.key === "DATABASE_URL" && dbError && !missing.includes("DATABASE_URL") && (
                    <div className="text-xs text-act mt-1">Database is set but not reachable or not migrated yet: {dbError}. Redeploy once so the migrations run.</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">Full instructions are in the README of the repository.</p>
      </div>
    </main>
  );
}
