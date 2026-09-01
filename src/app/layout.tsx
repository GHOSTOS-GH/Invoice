import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { SyncStatusProvider } from "@/components/shared/sync-status";

export const metadata: Metadata = {
  title: "Facturier Konté — Gestion de Factures",
  description:
    "Application professionnelle de gestion de factures, clients et produits. Fonctionne hors ligne avec synchronisation automatique.",
  manifest: "/manifest.json",
  applicationName: "Facturier Konté",
  keywords: [
    "factures",
    "facturation",
    "Sénégal",
    "FCFA",
    "gestion",
    "clients",
    "produits",
  ],
  authors: [{ name: "Konté Bussness Services" }],
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Facturier",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Facturier Konté — Gestion de Factures",
    description: "Factures, clients et produits. Hors ligne avec synchro auto.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <AuthProvider>
          <SyncStatusProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegister />
          </SyncStatusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
