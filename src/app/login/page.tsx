import { LoginForm } from "./login-form";
import { SetupNeeded } from "@/components/app/setup-needed";
import { missingEnv } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNeeded missing={missing} />;
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold mb-1">Household budget</h1>
        <p className="text-sm text-muted-foreground mb-4">Enter the shared household password.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
