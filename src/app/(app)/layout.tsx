import { redirect } from "next/navigation";
import { currentEditor, isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/db/load";
import { AppProviders } from "@/components/app/providers";
import { Shell } from "@/components/app/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  const [settings, editor] = await Promise.all([getSettings(), currentEditor()]);
  return (
    <AppProviders lang={settings.language === "FR" ? "fr" : "en"} editor={editor} names={{ ALEX: settings.alexName, SELIA: settings.seliaName }}>
      <Shell>{children}</Shell>
    </AppProviders>
  );
}
