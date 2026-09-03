// UI + domain constants reproducing lib/utils/constants.dart

// Design tokens from the Flutter app
export const CARD_RADIUS = 16;
export const BUTTON_RADIUS = 14;
export const INPUT_RADIUS = 14;

// Tailwind class equivalents for convenience
export const cardRadiusClass = "rounded-2xl"; // 16px
export const buttonRadiusClass = "rounded-[14px]";
export const inputRadiusClass = "rounded-[14px]";

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

export type UserRole = "client" | "employee" | "admin";

export const ROLE_META: Record<
  UserRole,
  { label: string; description: string; color: string }
> = {
  admin: {
    label: "Administrateur",
    description: "Accès total, gestion des comptes et réglages",
    color: "#2563EB",
  },
  employee: {
    label: "Employé",
    description: "Factures, clients et produits",
    color: "#16A34A",
  },
  client: {
    label: "Client",
    description: "Accès limité",
    color: "#9E9E9E",
  },
};

// App brand colors (from login_screen.dart gradient)
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

// Sync queue operation kinds
export type SyncOpKind = "create" | "update" | "delete";
export type SyncEntityType = "invoice" | "client" | "product";

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
