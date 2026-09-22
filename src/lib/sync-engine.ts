// Moteur de synchronisation SIMPLIFIÉ (compte mono-utilisateur par boutique).
// IndexedDB est la source de vérité locale immédiate : chaque donnée porte un
// syncState ("saved" = en ligne, "local" = enregistré localement uniquement).
// À chaque action : tentative d'envoi DIRECT au serveur. Si échec (hors ligne),
// la donnée reste localement avec le statut "local" et l'utilisateur utilise
// le bouton « Réessayer » simple. Pas de file d'attente, pas de retry auto.

import { getDB, countPendingLocal, getMeta, setMeta, type LocalInvoice, type LocalClient, type LocalProduct } from "./offline-db";
import { getTombstones, removeTombstone } from "./data-hooks";

const API_BASE = "/api";

let retrying = false;
let listeners: Array<(pending: number, retrying: boolean) => void> = [];

export function subscribeSync(
  cb: (pending: number, retrying: boolean) => void
): () => void {
  listeners.push(cb);
  // Emit current state immediately
  countPendingLocal().then((n) => cb(n, retrying));
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function emit(pending: number, retryingState: boolean) {
  for (const l of listeners) l(pending, retryingState);
}

async function apiFetch(path: string, init: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Erreurs d'autorisation : ne pas réessayer (401/403 = problème de compte)
    const err = new Error(body.error || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Pull fresh data from the server into IndexedDB (full replace). */
export async function pullFromServer(): Promise<void> {
  try {
    // Skip if not authenticated (avoid "Non authentifié" console spam on login page)
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) =>
      r.ok ? r.json() : null
    );
    const user = me?.user;
    if (!user) return;
    // Un compte non approuvé / sans abonnement actif n'a accès à aucune donnée métier
    if (user.role !== "superadmin" && (!user.isApproved || user.subscriptionStatus !== "active")) return;

    const [invoiceResponse, clients, products] = await Promise.all([
      apiFetch("/invoices?all=true", { method: "GET" }),
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
        await db.invoices.put({ ...inv, items: [], syncState: "saved" });
        for (const it of items) await db.invoiceItems.put(it);
      }
      await db.clients.bulkPut((clients as any[]).map((c) => ({ ...c, syncState: "saved" })));
      await db.products.bulkPut((products as any[]).map((p) => ({ ...p, syncState: "saved" })));
    });
  } catch {
    // Silent: expected when offline or unauthenticated
  }
}

/**
 * Réessaye l'envoi au serveur de toutes les données marquées "local"
 * (bouton « Réessayer » / « Sauvegarder en ligne »). Dernière écriture gagnante
 * via updatedAt. Les enregistrements envoyés avec succès passent en "saved".
 */
export async function retryPendingSync(): Promise<{ ok: number; failed: number; message?: string }> {
  if (retrying) return { ok: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: 0, failed: 0, message: "Hors ligne — reconnectez-vous au réseau puis réessayez" };
  }
  retrying = true;
  emit(await countPendingLocal(), true);
  let ok = 0;
  let failed = 0;
  let firstError: string | undefined;
  try {
    const db = getDB();

    // 1) Clients locaux
    const localClients = await db.clients.where("syncState").equals("local").toArray();
    for (const c of localClients as LocalClient[]) {
      try {
        const saved = await apiFetch(`/clients/${c.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: c.name, phone: c.phone, address: c.address }),
        });
        await db.clients.put({ ...(saved as LocalClient), syncState: "saved" });
        ok++;
      } catch (e: any) {
        failed++;
        firstError ??= e.message;
      }
    }

    // 2) Produits locaux
    const localProducts = await db.products.where("syncState").equals("local").toArray();
    for (const p of localProducts as LocalProduct[]) {
      try {
        const saved = await apiFetch(`/products/${p.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: p.name, category: p.category, imageUrl: p.imageUrl }),
        });
        await db.products.put({ ...(saved as LocalProduct), syncState: "saved" });
        ok++;
      } catch (e: any) {
        failed++;
        firstError ??= e.message;
      }
    }

    // 3) Factures locales (+ items)
    const localInvoices = await db.invoices.where("syncState").equals("local").toArray();
    for (const inv of localInvoices as LocalInvoice[]) {
      try {
        const items = await db.invoiceItems.where("invoiceId").equals(inv.id).toArray();
        const saved = await apiFetch(`/invoices/${inv.id}`, {
          method: "PUT",
          body: JSON.stringify({
            id: inv.id,
            clientName: inv.clientName,
            clientId: inv.clientId,
            status: inv.status,
            notes: inv.notes,
            createdBy: inv.createdBy,
            items: items.map(({ name, quantity, unitPrice }: any) => ({ name, quantity, unitPrice })),
          }),
        });
        await db.invoices.put({ ...(saved as LocalInvoice), items: [], syncState: "saved" });
        ok++;
      } catch (e: any) {
        failed++;
        firstError ??= e.message;
      }
    }

    // 4) Tombstones : suppressions effectuées hors ligne à rejouer côté serveur
    const tombstones = await getTombstones();
    for (const t of tombstones) {
      try {
        if (t.entity === "invoice") await apiFetch(`/invoices/${t.id}`, { method: "DELETE" });
        else if (t.entity === "client") await apiFetch(`/clients/${t.id}`, { method: "DELETE" });
        else if (t.entity === "product") await apiFetch(`/products/${t.id}`, { method: "DELETE" });
        await removeTombstone(t.entity, t.id);
        ok++;
      } catch (e: any) {
        // 404 = déjà supprimé côté serveur : succès, on retire le tombstone
        if (e?.status === 404) {
          await removeTombstone(t.entity, t.id);
          ok++;
        } else {
          failed++;
          firstError ??= e.message;
        }
      }
    }

    if (ok > 0) await pullFromServer();
  } catch (err) {
    console.error("[sync] retry global échoué", err);
  } finally {
    retrying = false;
    emit(await countPendingLocal(), false);
  }
  return { ok, failed, message: firstError };
}

let started = false;
/** À lancer une fois au démarrage client : écoute le retour du réseau pour proposer un retry. */
export function startSyncEngine() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Au retour du réseau : on tente un envoi direct des données locales non sauvegardées.
  // C'est le seul « automatisme » : simple, sans file d'attente ni retry périodique.
  window.addEventListener("online", () => {
    void countPendingLocal().then((n) => {
      if (n > 0) void retryPendingSync();
      else void pullFromServer();
    });
  });
}
