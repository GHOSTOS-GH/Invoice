// Sync engine: flushes the local IndexedDB queue to the server API
// whenever navigator.onLine becomes true. Uses "last write wins" based on
// updatedAt timestamps (server returns the canonical record).

import { getDB, countPendingSync, type SyncQueueItem } from "./offline-db";

const API_BASE = "/api";

let syncing = false;
let listeners: Array<(pending: number, syncing: boolean) => void> = [];
export interface SyncAttemptResult {
  id: string;
  entity: string;
  op: string;
  ok: boolean;
  message: string;
}

export function subscribeSync(
  cb: (pending: number, syncing: boolean) => void
): () => void {
  listeners.push(cb);
  // Emit current state immediately
  countPendingSync().then((n) => cb(n, syncing));
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function emit(pending: number, syncingState: boolean) {
  for (const l of listeners) l(pending, syncingState);
}

async function apiFetch(path: string, init: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Pull fresh data from the server into IndexedDB (full replace for the session). */
export async function pullFromServer(): Promise<void> {
  try {
    // Skip if not authenticated (avoid "Non authentifié" console spam on login page)
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) =>
      r.ok ? r.json() : null
    );
    if (!me?.user) return;

    const [invoiceResponse, clients, products] = await Promise.all([
      apiFetch("/invoices", { method: "GET" }),
      apiFetch("/clients", { method: "GET" }),
      apiFetch("/products", { method: "GET" }),
    ]);
    const invoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse.invoices ?? [];
    const db = getDB();
    await db.transaction("rw", db.invoices, db.invoiceItems, db.clients, db.products, async () => {
      await db.invoices.clear();
      await db.invoiceItems.clear();
      await db.clients.clear();
      await db.products.clear();
      for (const inv of invoices as any[]) {
        const items = inv.items ?? [];
        await db.invoices.put({ ...inv, items: undefined });
        for (const it of items) await db.invoiceItems.put(it);
      }
      await db.clients.bulkPut(clients);
      await db.products.bulkPut(products);
    });
  } catch (e) {
    // Silent: expected when offline or unauthenticated
  }
}

async function processQueueItem(item: SyncQueueItem): Promise<SyncAttemptResult> {
  const { entity, op, payload } = item;
  console.info("[sync] tentative", { id: item.id, entity, op });
  try {
    if (entity === "invoice") {
      if (op === "delete") {
        await apiFetch(`/invoices/${payload.id}`, { method: "DELETE" });
      } else {
        // create or update — PUT with id handles both (server upserts)
        await apiFetch(`/invoices/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
    } else if (entity === "client") {
      if (op === "delete") {
        await apiFetch(`/clients/${payload.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/clients/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
    } else if (entity === "product") {
      if (op === "delete") {
        await apiFetch(`/products/${payload.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/products/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
    }
    const result = { id: item.id, entity, op, ok: true, message: "HTTP succès" };
    console.info("[sync] succès", result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] échec", { id: item.id, entity, op, message });
    return { id: item.id, entity, op, ok: false, message };
  }
}

/** Flush the entire pending queue to the server. */
export async function flushQueue(): Promise<SyncAttemptResult[]> {
  if (syncing) return [];
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  syncing = true;
  const results: SyncAttemptResult[] = [];
  emit(await countPendingSync(), true);
  try {
    const db = getDB();
    const items = await db.syncQueue.orderBy("createdAt").toArray();
    for (const item of items) {
      const result = await processQueueItem(item);
      results.push(result);
      if (result.ok) {
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, { retries: item.retries + 1 });
      }
    }
    // After flushing, pull fresh canonical data so local store reflects server
    await pullFromServer();
  } catch (err) {
    console.error("[sync] flush global échoué", err);
  } finally {
    syncing = false;
    emit(await countPendingSync(), false);
  }
  return results;
}

let started = false;
/** Start listening to online events and flush automatically. Call once on the client. */
export function startSyncEngine() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    console.info("[sync] réseau disponible, vidage automatique");
    void flushQueue();
  });
  window.addEventListener("sync-queue-added", () => {
    if (navigator.onLine) void flushQueue();
  });
  // Also attempt a flush on startup if already online
  if (navigator.onLine) {
    setTimeout(() => void flushQueue(), 1500);
  }
  // Periodic retry every 60s while online (covers flaky connections)
  setInterval(() => {
    if (navigator.onLine) void flushQueue();
  }, 60000);
}
