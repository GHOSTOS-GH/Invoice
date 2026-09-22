// Root page — renders the app shell. Le garde d'accès (compte non approuvé,
// abonnement inactif, maintenance) est appliqué côté client dans AppShell et
// côté serveur dans chaque route API (requireActiveClient / requireSuperadmin).
import { AppShell } from "@/components/app-shell";
import { ViewRouter } from "@/components/view-router";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell maintenanceMode={false}>
      <ViewRouter />
    </AppShell>
  );
}
