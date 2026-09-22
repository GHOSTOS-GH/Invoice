"use client";
// Data hooks — modèle offline SIMPLIFIÉ (compte mono-utilisateur) :
// IndexedDB est la source de vérité locale immédiate. Chaque mutation est
// écrite localement puis envoyée DIRECTEMENT au serveur si en ligne ;
// en cas d'échec elle reste en local avec le statut "non sauvegardé en ligne"
// (syncState: "local") et peut être renvoyée via le bouton « Réessayer ».
// Pas de file d'attente complexe : ni queue, ni retry automatique en fond.

import { useEffect, useState, useCallback, useRef } from "react";
import type { Invoice, Client, Product, Settings, InvoiceItem } from "@/lib/types";
import { getDB, countPendingLocal, setMeta, getMeta, localId, type LocalInvoice, type LocalClient, type LocalProduct } from "@/lib/offline-db";
import { useSyncStatus } from "@/components/shared/sync-status";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------- Tombstones (suppressions hors ligne) ----------
// Simple liste d'ids à supprimer côté serveur, stockée dans la table meta.
// Traitées par le bouton « Réessayer » (retryPendingSync dans sync-engine).

export interface Tombstone {
  entity: "invoice" | "client" | "product";
  id: string;
  at: number;
}

async function addTombstone(entity: Tombstone["entity"], id: string) {
  try {
    const list = (await getMeta<Tombstone[]>("tombstones")) ?? [];
    if (!list.some((t) => t.entity === entity && t.id === id)) {
      list.push({ entity, id, at: Date.now() });
      await setMeta("tombstones", list);
    }
  } catch {}
}

async function getTombstones(): Promise<Tombstone[]> {
  try {
    return (await getMeta<Tombstone[]>("tombstones")) ?? [];
  } catch {
    return [];
  }
}

export async function removeTombstone(entity: Tombstone["entity"], id: string) {
  try {
    const list = (await getMeta<Tombstone[]>("tombstones")) ?? [];
    await setMeta(
      "tombstones",
      list.filter((t) => !(t.entity === entity && t.id === id))
    );
  } catch {}
}

export { getTombstones };

// ---------- Invoices ----------

export function useInvoices(options: { all?: boolean } = {}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { online } = useSyncStatus();
  const hasData = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      setLoading(!hasData.current);
      setError(null);
      try {
        if (navigator.onLine) {
          const query = options.all ? "?all=true" : `?page=${nextPage}&pageSize=30`;
          const result = await api<{ invoices: Invoice[]; pagination: { hasMore: boolean } }>(
            `/api/invoices${query}`
          );
          setInvoices((current) => (append ? [...current, ...result.invoices] : result.invoices));
          setHasMore(result.pagination.hasMore);
          pageRef.current = nextPage;
          hasData.current = true;
          // Cache locally (sans écraser les données locales non sauvegardées)
          try {
            const db = getDB();
            const pending = await db.invoices.where("syncState").equals("local").toArray();
            if (!append) {
              await db.invoices.clear();
              await db.invoiceItems.clear();
            }
            for (const inv of result.invoices) {
              const { items, ...invData } = inv;
              await db.invoices.put({ ...invData, syncState: "saved" } as LocalInvoice);
              if (items) for (const it of items) await db.invoiceItems.put(it);
            }
            // Les modifications locales en attente restent prioritaires à l'affichage
            for (const inv of pending) {
              await db.invoices.put(inv);
              const items = await db.invoiceItems.where("invoiceId").equals(inv.id).toArray();
              if (items.length > 0) for (const it of items) await db.invoiceItems.put(it);
            }
            await setMeta("invoicesLastSync", Date.now());
          } catch {}
        } else {
          // Hors ligne : lecture depuis IndexedDB (source de vérité locale)
          const db = getDB();
          const invs = await db.invoices.toArray();
          const items = await db.invoiceItems.toArray();
          setInvoices(
            invs
              .map((inv) => ({
                ...inv,
                items: items.filter((it) => it.invoiceId === inv.id),
              })) as Invoice[]
          );
          hasData.current = true;
        }
      } catch (e: any) {
        setError(e.message);
        // Fallback IndexedDB
        try {
          const db = getDB();
          const invs = await db.invoices.toArray();
          const items = await db.invoiceItems.toArray();
          setInvoices(
            invs
              .map((inv) => ({
                ...inv,
                items: items.filter((it) => it.invoiceId === inv.id),
              })) as Invoice[]
          );
        } catch {}
      } finally {
        setLoading(false);
      }
    },
    [options.all]
  );

  useEffect(() => {
    load();
    let lastFocusRefresh = 0;
    const refreshOnFocus = () => {
      const now = Date.now();
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        now - lastFocusRefresh >= 120_000
      ) {
        lastFocusRefresh = now;
        load();
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    const refreshOnRequest = () => load();
    window.addEventListener("invoice-sync-request", refreshOnRequest);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("invoice-sync-request", refreshOnRequest);
    };
  }, [load, online]);

  const loadMore = useCallback(() => {
    if (!options.all && hasMore && !loading) return load(pageRef.current + 1, true);
  }, [hasMore, loading, load, options.all]);

  return { invoices, loading, error, hasMore, loadMore, refresh: () => load(1, false) };
}

/** Crée ou met à jour une facture : écriture locale immédiate, puis envoi direct. */
export async function saveInvoice(
  invoice: Partial<Invoice> & { id: string; clientName: string; items: InvoiceItem[] }
): Promise<Invoice> {
  const db = getDB();
  const local: LocalInvoice = {
    id: invoice.id,
    clientName: invoice.clientName,
    clientId: invoice.clientId ?? null,
    status: invoice.status ?? "enCours",
    notes: invoice.notes ?? null,
    createdBy: invoice.createdBy ?? "",
    createdAt: invoice.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: invoice.items,
    syncState: "local",
  };
  // 1) Source de vérité locale immédiate (items stockés dans la table dédiée)
  await db.invoices.put({ ...local, items: [] });
  await db.invoiceItems.where("invoiceId").equals(invoice.id).delete();
  for (const it of local.items) await db.invoiceItems.put({ ...it, invoiceId: invoice.id });

  // 2) Tentative d'envoi direct au serveur
  try {
    const saved = await api<Invoice>(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      body: JSON.stringify(invoice),
    });
    const { items: savedItems, ...savedNoItems } = saved;
    await db.invoices.put({ ...savedNoItems, items: [], syncState: "saved" });
    await db.invoiceItems.where("invoiceId").equals(saved.id).delete();
    for (const it of savedItems ?? []) await db.invoiceItems.put(it);
    return saved;
  } catch {
    // Hors ligne ou échec : reste "local" (non sauvegardé en ligne), visible dans l'UI
    return local;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = getDB();
  // Retrait local immédiat (l'UI reflète la suppression tout de suite)
  await db.invoiceItems.where("invoiceId").equals(id).delete();
  await db.invoices.delete(id);
  try {
    await api(`/api/invoices/${id}`, { method: "DELETE" });
  } catch {
    // Hors ligne : mémoriser pour supprimer côté serveur au prochain « Réessayer »
    await addTombstone("invoice", id);
  }
}

// ---------- Clients ----------

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { online } = useSyncStatus();
  const hasData = useRef(false);

  const load = useCallback(async () => {
    setLoading(!hasData.current);
    try {
      if (navigator.onLine) {
        const data = await api<Client[]>("/api/clients");
        setClients(data);
        hasData.current = true;
        try {
          const db = getDB();
          const pending = await db.clients.where("syncState").equals("local").toArray();
          await db.clients.clear();
          await db.clients.bulkPut(data.map((c) => ({ ...c, syncState: "saved" } as LocalClient)));
          for (const c of pending) await db.clients.put(c);
        } catch {}
      } else {
        const db = getDB();
        setClients(await db.clients.toArray());
        hasData.current = true;
      }
    } catch {
      try {
        const db = getDB();
        setClients(await db.clients.toArray());
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let lastFocusRefresh = 0;
    const refreshOnFocus = () => {
      const now = Date.now();
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        now - lastFocusRefresh >= 120_000
      ) {
        lastFocusRefresh = now;
        load();
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    const refreshOnRequest = () => load();
    window.addEventListener("invoice-sync-request", refreshOnRequest);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("invoice-sync-request", refreshOnRequest);
    };
  }, [load, online]);

  return { clients, loading, refresh: load };
}

export async function createClient(data: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<Client> {
  const db = getDB();
  try {
    const saved = await api<Client>("/api/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await db.clients.put({ ...saved, syncState: "saved" } as LocalClient);
    return saved;
  } catch {
    // Hors ligne : création locale avec un id généré (renvoyé au serveur plus tard)
    const local: LocalClient = {
      id: localId("cl"),
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
      createdBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: "local",
    };
    await db.clients.put(local);
    return local;
  }
}

export async function saveClient(
  client: Partial<Client> & { id: string; name: string }
): Promise<Client> {
  const db = getDB();
  const existing = await db.clients.get(client.id);
  const local: LocalClient = {
    id: client.id,
    name: client.name,
    phone: client.phone ?? existing?.phone ?? null,
    address: client.address ?? existing?.address ?? null,
    createdBy: client.createdBy ?? existing?.createdBy ?? "",
    createdAt: client.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncState: "local",
  };
  await db.clients.put(local);
  try {
    const saved = await api<Client>(`/api/clients/${client.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: local.name, phone: local.phone, address: local.address }),
    });
    await db.clients.put({ ...saved, syncState: "saved" } as LocalClient);
    return saved;
  } catch {
    return local;
  }
}

export async function deleteClient(id: string): Promise<void> {
  const db = getDB();
  await db.clients.delete(id);
  try {
    await api(`/api/clients/${id}`, { method: "DELETE" });
  } catch {
    await addTombstone("client", id);
  }
}

// ---------- Products ----------

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { online } = useSyncStatus();
  const hasData = useRef(false);

  const load = useCallback(async () => {
    setLoading(!hasData.current);
    try {
      if (navigator.onLine) {
        const data = await api<Product[]>("/api/products");
        setProducts(data);
        hasData.current = true;
        try {
          const db = getDB();
          const pending = await db.products.where("syncState").equals("local").toArray();
          await db.products.clear();
          await db.products.bulkPut(data.map((p) => ({ ...p, syncState: "saved" } as LocalProduct)));
          for (const p of pending) await db.products.put(p);
        } catch {}
      } else {
        const db = getDB();
        setProducts(await db.products.toArray());
        hasData.current = true;
      }
    } catch {
      try {
        const db = getDB();
        setProducts(await db.products.toArray());
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let lastFocusRefresh = 0;
    const refreshOnFocus = () => {
      const now = Date.now();
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        now - lastFocusRefresh >= 120_000
      ) {
        lastFocusRefresh = now;
        load();
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    const refreshOnRequest = () => load();
    window.addEventListener("invoice-sync-request", refreshOnRequest);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("invoice-sync-request", refreshOnRequest);
    };
  }, [load, online]);

  return { products, loading, refresh: load };
}

export async function createProduct(data: {
  name: string;
  category: string;
  imageUrl?: string;
}): Promise<Product> {
  const db = getDB();
  try {
    const saved = await api<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await db.products.put({ ...saved, syncState: "saved" } as LocalProduct);
    return saved;
  } catch {
    const local: LocalProduct = {
      id: localId("pr"),
      name: data.name,
      category: data.category,
      imageUrl: data.imageUrl ?? null,
      createdBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: "local",
    };
    await db.products.put(local);
    return local;
  }
}

export async function saveProduct(
  product: Partial<Product> & { id: string; name: string; category: string }
): Promise<Product> {
  const db = getDB();
  const existing = await db.products.get(product.id);
  const local: LocalProduct = {
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl ?? existing?.imageUrl ?? null,
    createdBy: product.createdBy ?? existing?.createdBy ?? "",
    createdAt: product.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncState: "local",
  };
  await db.products.put(local);
  try {
    const saved = await api<Product>(`/api/products/${product.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: local.name, category: local.category, imageUrl: local.imageUrl }),
    });
    await db.products.put({ ...saved, syncState: "saved" } as LocalProduct);
    return saved;
  } catch {
    return local;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDB();
  await db.products.delete(id);
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
  } catch {
    await addTombstone("product", id);
  }
}

// ---------- Settings (en ligne uniquement — rarement modifiés hors ligne) ----------

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Settings>("/api/settings");
      setSettings(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { settings, loading, refresh: load };
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  return api<Settings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---------- Upload ----------

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Upload échoué");
  }
  const data = await res.json();
  return data.url;
}

export async function uploadDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) throw new Error("Upload échoué");
  const data = await res.json();
  return data.url;
}

// ---------- Statut local (pour la bannière / le bouton Réessayer) ----------

export { countPendingLocal };
