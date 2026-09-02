"use client";
// Routes between screens based on the current NavContext view.

import { useNav } from "@/components/app-shell";
import { DashboardScreen } from "@/components/screens/dashboard-screen";
import { InvoicesScreen } from "@/components/screens/invoices-screen";
import { NewInvoiceScreen } from "@/components/screens/new-invoice-screen";
import { InvoiceDetailScreen } from "@/components/screens/invoice-detail-screen";
import { ClientsScreen } from "@/components/screens/clients-screen";
import { UsersScreen } from "@/components/screens/users-screen";
import dynamic from "next/dynamic";

const ProductsScreen = dynamic(() => import("@/components/screens/products-screen").then((m) => m.ProductsScreen));
const StatsScreen = dynamic(() => import("@/components/screens/stats-screen").then((m) => m.StatsScreen));
const SettingsScreen = dynamic(() => import("@/components/screens/settings-screen").then((m) => m.SettingsScreen));
const CsvImportScreen = dynamic(() => import("@/components/screens/csv-import-screen").then((m) => m.CsvImportScreen));

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
