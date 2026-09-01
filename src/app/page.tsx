// Root page — checks maintenance mode server-side, then renders the app shell.
import { db } from "@/lib/db";
import { AppShell, type ViewId } from "@/components/app-shell";
import { ViewRouter } from "@/components/view-router";

export const dynamic = "force-dynamic";

export default async function Home() {
  let maintenanceMode = false;
  try {
    let settings = await db.settings.findUnique({ where: { id: "singleton" } });
    maintenanceMode = settings?.maintenanceMode ?? false;
  } catch {
    maintenanceMode = false;
  }

  return (
    <AppShell maintenanceMode={maintenanceMode}>
      <ViewRouter />
    </AppShell>
  );
}
