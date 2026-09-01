// Shared TypeScript domain types — mirrors the Prisma models

export type InvoiceStatus = "enCours" | "enLivraison" | "livree" | "archivee";
export type UserRole = "client" | "employee" | "admin";

export interface InvoiceItem {
  id: string;
  invoiceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  clientName: string;
  clientId?: string | null;
  status: InvoiceStatus;
  notes?: string | null;
  discount: number;
  taxRate: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  imageUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: string;
  maintenanceMode: boolean;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopNinea: string;
  footerMessage: string;
  logoUrl?: string | null;
  updatedAt: string;
}

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  name?: string | null;
  disabled: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  phone: string;
  role: UserRole;
  name?: string | null;
}

// ---------- Derived calculations (mirror invoice.dart) ----------

export function itemSubtotal(item: { quantity: number; unitPrice: number }) {
  return item.quantity * item.unitPrice;
}

export function invoiceTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((s, it) => s + itemSubtotal(it), 0);
}

export function invoiceTaxAmount(inv: {
  items: { quantity: number; unitPrice: number }[];
  discount: number;
  taxRate: number;
}) {
  const total = invoiceTotal(inv.items);
  return Math.max(0, total - inv.discount) * (inv.taxRate / 100);
}

export function invoicePayableTotal(inv: {
  items: { quantity: number; unitPrice: number }[];
  discount: number;
  taxRate: number;
}) {
  const total = invoiceTotal(inv.items);
  return Math.max(0, total - inv.discount) + invoiceTaxAmount(inv);
}

export function invoiceTotalQuantity(items: { quantity: number }[]) {
  return items.reduce((s, it) => s + it.quantity, 0);
}

// ---------- Auth payload ----------

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  phone: string;
  password: string;
  name?: string;
}
