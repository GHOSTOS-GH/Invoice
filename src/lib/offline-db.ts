// Offline-first local store using Dexie (IndexedDB).
// Stores local copies of invoices/clients/products + a sync queue.
// Mirrors the offline-first requirement: every mutation works offline,
// is stored with a "pending sync" flag, then flushed to the server on reconnect.

import Dexie, { type Table } from "dexie";
import type { Invoice, Client, Product, InvoiceItem } from "./types";
import type { SyncOpKind, SyncEntityType } from "./constants";

export interface SyncQueueItem {
  id: string; // cuid-style local id
  entity: SyncEntityType;
  op: SyncOpKind;
  payload: any; // the full entity for create/update, or { id } for delete
  createdAt: number;
  retries: number;
}

export class InvoicePwaDB extends Dexie {
  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  clients!: Table<Client, string>;
  products!: Table<Product, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super("invoice_pwa_db");
    this.version(1).stores({
      invoices: "id, clientName, status, createdAt, updatedAt, clientId",
      invoiceItems: "id, invoiceId, name",
      clients: "id, name, createdAt",
      products: "id, category, name",
      syncQueue: "id, entity, op, createdAt",
      meta: "key",
    });
  }
}

// Singleton (works on client only; guard for SSR)
let _db: InvoicePwaDB | null = null;
export function getDB(): InvoicePwaDB {
  if (typeof window === "undefined") {
    // Return a no-op stub during SSR — methods won't be called.
    throw new Error("Dexie DB accessed on server");
  }
  if (!_db) _db = new InvoicePwaDB();
  return _db;
}

// ---------- Sync queue helpers ----------

let _idCounter = 0;
export function localId(prefix = "local"): string {
  _idCounter++;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function enqueueSync(
  entity: SyncEntityType,
  op: SyncOpKind,
  payload: any
): Promise<void> {
  try {
    const db = getDB();
    await db.syncQueue.add({
      id: localId("sync"),
      entity,
      op,
      payload,
      createdAt: Date.now(),
      retries: 0,
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("sync-queue-added"));
  } catch (e) {
    console.warn("enqueueSync failed (IndexedDB unavailable?):", e);
  }
}

export async function countPendingSync(): Promise<number> {
  try {
    return await getDB().syncQueue.count();
  } catch {
    return 0;
  }
}

export async function clearAllLocal(): Promise<void> {
  try {
    const db = getDB();
    await Promise.all([
      db.invoices.clear(),
      db.invoiceItems.clear(),
      db.clients.clear(),
      db.products.clear(),
      db.syncQueue.clear(),
      db.meta.clear(),
    ]);
  } catch (e) {
    console.warn("clearAllLocal failed:", e);
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
