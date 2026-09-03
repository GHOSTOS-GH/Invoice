// Shared TypeScript domain types — mirrors the Prisma models

export type InvoiceStatus = "enCours" | "enLivraison" | "livree";
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

// ---------- Derived calculations (mirror invoice.dart, simplified) ----------
// Calculation is strictly: for each item, quantity × unit_price = line subtotal.
// The invoice total is the sum of all line subtotals. No discount, no tax.

export function itemSubtotal(item: { quantity: number; unitPrice: number }) {
  return item.quantity * item.unitPrice;
}

/** Sum of all line subtotals (quantity × unit_price). */
export function invoiceTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((s, it) => s + itemSubtotal(it), 0);
}

/**
 * Total to pay = sum of all line subtotals.
 * Accepts either an invoice object (with `items`) or an items array directly,
 * so all existing call sites keep working. No discount, no tax — ever.
 */
export function invoicePayableTotal(inv: { items: { quantity: number; unitPrice: number }[] }) {
  return invoiceTotal(inv.items);
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
