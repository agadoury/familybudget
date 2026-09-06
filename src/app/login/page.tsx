import { LoginForm } from "./login-form";
import { SetupNeeded } from "@/components/app/setup-needed";
import { missingEnv } from "@/lib/env";
import { needsPasswordSetup } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNeeded missing={missing} />;
  let create = false;
  try {
    create = await needsPasswordSetup();
  } catch (e) {
    return <SetupNeeded missing={[]} dbError={e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "unknown error"} />;
  }
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">{create ? "Welcome" : "Household budget"}</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {create ? "Choose the password you will both use to open the app. You can change it later in Settings." : "Enter the shared household password."}
        </p>
        <LoginForm next={next} create={create} />
      </div>
    </main>
  );
}
