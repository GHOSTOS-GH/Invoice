// UI + domain constants — plateforme SaaS multi-tenant

// Invoice status enum reproduction (InvoiceStatus in invoice.dart)
export type InvoiceStatus = "enCours" | "enLivraison" | "livree";

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string; text: string; dot: string }
> = {
  enCours: {
    label: "En cours",
    color: "#6B4C4C",
    bg: "bg-[#6B4C4C]/10",
    text: "text-[#6B4C4C]",
    dot: "bg-[#6B4C4C]",
  },
  enLivraison: {
    label: "En livraison",
    color: "#FFC107",
    bg: "bg-[#FFC107]/15",
    text: "text-[#B8860B]",
    dot: "bg-[#FFC107]",
  },
  livree: {
    label: "Livrée",
    color: "#4CAF50",
    bg: "bg-[#4CAF50]/10",
    text: "text-[#4CAF50]",
    dot: "bg-[#4CAF50]",
  },
};

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "enCours",
  "enLivraison",
  "livree",
];

export type UserRole = "superadmin" | "client";
export type SubscriptionStatus = "pending" | "active" | "suspended" | "expired";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "pending",
  "active",
  "suspended",
  "expired",
];

export const SUBSCRIPTION_META: Record<
  SubscriptionStatus,
  { label: string; color: string; bg: string; text: string }
> = {
  pending: {
    label: "En attente",
    color: "#F59E0B",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  active: {
    label: "Actif",
    color: "#16A34A",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  suspended: {
    label: "Suspendu",
    color: "#F97316",
    bg: "bg-orange-100",
    text: "text-orange-700",
  },
  expired: {
    label: "Expiré",
    color: "#DC2626",
    bg: "bg-red-100",
    text: "text-red-700",
  },
};

export const ROLE_META: Record<
  UserRole,
  { label: string; description: string; color: string }
> = {
  superadmin: {
    label: "Superadmin",
    description: "Gestion de la plateforme et des comptes",
    color: "#7C3AED",
  },
  client: {
    label: "Client",
    description: "Boutique : factures, clients, produits",
    color: "#2563EB",
  },
};

// App brand colors
export const BRAND = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryDarkest: "#1E3A8A",
  ink: "#0F172A",
  body: "#64748B",
  muted: "#94A3B8",
  surface: "#F8FAFC",
  border: "#E2E8F0",
};

// CSV column keys for import/export compatibility with the mobile app
export const CSV_COLUMNS = [
  "Date",
  "Réf",
  "Client",
  "Statut",
  "Article",
  "Quantité",
  "Prix unitaire",
  "Sous-total",
  "Total facture",
  "Notes",
] as const;

// JWT + session
export const SESSION_COOKIE = "inv_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
