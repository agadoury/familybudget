/** Shown instead of the app when the deployment has no database yet. Server component. */
export function SetupNeeded({ missing, dbError }: { missing: string[]; dbError?: string | null }) {
  const noDb = missing.includes("DATABASE_URL");
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Almost there</h1>
          <p className="text-muted-foreground mt-1">The app is deployed. One thing left: it needs a database.</p>
        </div>
        <ol className="space-y-3">
          <li className="flex gap-3 rounded-xl border p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-primary text-primary-foreground">1</span>
            <div>
              <div className="font-medium">Create the database</div>
              <div className="text-sm text-muted-foreground">In the Vercel project: <strong>Storage</strong> → <strong>Create Database</strong> → <strong>Postgres</strong> → accept the defaults → <strong>Connect</strong>. Vercel fills in the connection automatically.</div>
              {!noDb && dbError && <div className="text-xs text-act mt-1">A database is connected but not ready: {dbError}</div>}
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-primary text-primary-foreground">2</span>
            <div>
              <div className="font-medium">Redeploy</div>
              <div className="text-sm text-muted-foreground"><strong>Deployments</strong> → latest → <strong>⋯</strong> → <strong>Redeploy</strong>. The build sets up the tables, then this page becomes the sign-in screen where you choose your household password.</div>
            </div>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">No other settings are required. Optional: <code>HOUSEHOLD_PASSWORD</code> and <code>SESSION_SECRET</code> environment variables override the in-app password and the derived secret.</p>
      </div>
    </main>
  );
}
