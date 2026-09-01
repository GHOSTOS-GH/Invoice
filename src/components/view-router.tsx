"use client";
// Routes between screens based on the current NavContext view.

import { useNav } from "@/components/app-shell";
import { DashboardScreen } from "@/components/screens/dashboard-screen";
import { InvoicesScreen } from "@/components/screens/invoices-screen";
import { NewInvoiceScreen } from "@/components/screens/new-invoice-screen";
import { InvoiceDetailScreen } from "@/components/screens/invoice-detail-screen";
import { ClientsScreen } from "@/components/screens/clients-screen";
import { ProductsScreen } from "@/components/screens/products-screen";
import { StatsScreen } from "@/components/screens/stats-screen";
import { SettingsScreen } from "@/components/screens/settings-screen";
import { CsvImportScreen } from "@/components/screens/csv-import-screen";
import { UsersScreen } from "@/components/screens/users-screen";

export function ViewRouter() {
  const { view, params } = useNav();

  switch (view) {
    case "dashboard":
      return <DashboardScreen />;
    case "invoices":
      return <InvoicesScreen />;
    case "new-invoice":
      return <NewInvoiceScreen editInvoiceId={params.invoiceId} />;
    case "invoice-detail":
      return <InvoiceDetailScreen invoiceId={params.invoiceId} />;
    case "clients":
      return <ClientsScreen />;
    case "products":
      return <ProductsScreen />;
    case "stats":
      return <StatsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "csv-import":
      return <CsvImportScreen />;
    case "users":
      return <UsersScreen />;
    default:
      return <DashboardScreen />;
  }
}
