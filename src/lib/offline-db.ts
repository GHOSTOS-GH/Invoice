// Offline-first local store using Dexie (IndexedDB).
// IndexedDB est la source de vérité locale immédiate : toutes les mutations
// fonctionnent hors ligne, chaque donnée porte un statut de sauvegarde clair
// ("saved" = en ligne, "local" = enregistré localement uniquement).
// La synchronisation est SIMPLE : envoi direct au moment de l'action si en ligne,
// sinon statut "local" + bouton « Sauvegarder en ligne » / « Réessayer » explicite.
// Pas de file d'attente, pas de retry automatique en arrière-plan.

import Dexie, { type Table } from "dexie";
import type { Invoice, Client, Product, InvoiceItem } from "./types";

export type SyncState = "saved" | "local";

export interface LocalInvoice extends Invoice {
  syncState: SyncState;
}
export interface LocalClient extends Client {
  syncState: SyncState;
}
export interface LocalProduct extends Product {
  syncState: SyncState;
}

export class InvoicePwaDB extends Dexie {
  invoices!: Table<LocalInvoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  clients!: Table<LocalClient, string>;
  products!: Table<LocalProduct, string>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super("invoice_pwa_db");
    this.version(1).stores({
      invoices: "id, clientName, status, createdAt, updatedAt, clientId, syncState",
      invoiceItems: "id, invoiceId, name",
      clients: "id, name, createdAt, syncState",
      products: "id, category, name, syncState",
      meta: "key",
    });
  }
}

// Singleton (works on client only; guard for SSR)
let _db: InvoicePwaDB | null = null;
export function getDB(): InvoicePwaDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie DB accessed on server");
  }
  if (!_db) _db = new InvoicePwaDB();
  return _db;
}

let _idCounter = 0;
export function localId(prefix = "local"): string {
  _idCounter++;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function clearAllLocal(): Promise<void> {
  try {
    const db = getDB();
    await Promise.all([
      db.invoices.clear(),
      db.invoiceItems.clear(),
      db.clients.clear(),
      db.products.clear(),
      db.meta.clear(),
    ]);
  } catch (e) {
    console.warn("clearAllLocal failed:", e);
  }
}

/** Nombre d'enregistrements locaux non sauvegardés en ligne. */
export async function countPendingLocal(): Promise<number> {
  try {
    const db = getDB();
    const [i, c, p] = await Promise.all([
      db.invoices.where("syncState").equals("local").count(),
      db.clients.where("syncState").equals("local").count(),
      db.products.where("syncState").equals("local").count(),
    ]);
    return i + c + p;
  } catch {
    return 0;
  }
}

export async function setMeta(key: string, value: any) {
  try {
    await getDB().meta.put({ key, value });
  } catch {}
}
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  try {
    const row = await getDB().meta.get(key);
    return row?.value as T | undefined;
  } catch {
    return undefined;
  }
}
