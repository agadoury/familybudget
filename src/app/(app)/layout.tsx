import { redirect } from "next/navigation";
import { currentEditor, isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/db/load";
import { AppProviders } from "@/components/app/providers";
import { Shell } from "@/components/app/shell";
import { SetupNeeded } from "@/components/app/setup-needed";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNeeded missing={missing} />;
  let settings: Awaited<ReturnType<typeof getSettings>>;
  let authed = false;
  try {
    settings = await getSettings();
    authed = await isAuthenticated();
  } catch (e) {
    return <SetupNeeded missing={[]} dbError={e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "unknown error"} />;
  }
  if (!authed) redirect("/login");
  const editor = await currentEditor();
  return (
    <AppProviders lang={settings.language === "FR" ? "fr" : "en"} editor={editor} names={{ ALEX: settings.alexName, SELIA: settings.seliaName }}>
      <Shell>{children}</Shell>
    </AppProviders>
  );
}
