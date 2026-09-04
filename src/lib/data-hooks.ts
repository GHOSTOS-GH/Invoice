"use client";
// Data hooks: fetch from API (online) with IndexedDB fallback (offline).
// Mutations write to the API and, on failure, queue locally for sync.

import { useEffect, useState, useCallback, useRef } from "react";
import type { Invoice, Client, Product, Settings, InvoiceItem } from "@/lib/types";
import { getDB, enqueueSync, setMeta, getMeta } from "@/lib/offline-db";
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

// ---------- Invoices ----------

export function useInvoices(options: { all?: boolean } = {}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { online } = useSyncStatus();
  const hasData = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const load = useCallback(async (nextPage = 1, append = false) => {
    setLoading(!hasData.current);
    setError(null);
    try {
      if (navigator.onLine) {
        const query = options.all ? "?all=true" : `?page=${nextPage}&pageSize=30`;
        const result = await api<{ invoices: Invoice[]; pagination: { hasMore: boolean } }>(`/api/invoices${query}`);
        setInvoices((current) => append ? [...current, ...result.invoices] : result.invoices);
        setHasMore(result.pagination.hasMore);
        pageRef.current = nextPage;
        hasData.current = true;
        // Cache locally
        try {
          const db = getDB();
          if (!append) {
            await db.invoices.clear();
            await db.invoiceItems.clear();
          }
          for (const inv of result.invoices) {
            const { items, ...invData } = inv;
            await db.invoices.put(invData as any);
            if (items) for (const it of items) await db.invoiceItems.put(it);
          }
          await setMeta("invoicesLastSync", Date.now());
        } catch {}
      } else {
        // Offline: read from IndexedDB
        const db = getDB();
        const invs = await db.invoices.toArray();
        const items = await db.invoiceItems.toArray();
        setInvoices(
          invs.map((inv) => ({
            ...inv,
            items: items.filter((it) => it.invoiceId === inv.id),
          })) as Invoice[]
        );
      }
    } catch (e: any) {
      setError(e.message);
      // Fallback to IndexedDB
      try {
        const db = getDB();
        const invs = await db.invoices.toArray();
        const items = await db.invoiceItems.toArray();
        setInvoices(
          invs.map((inv) => ({
            ...inv,
            items: items.filter((it) => it.invoiceId === inv.id),
          })) as Invoice[]
        );
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [options.all]);

  useEffect(() => {
    load();
    let lastFocusRefresh = 0;
    const refreshOnFocus = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && navigator.onLine && now - lastFocusRefresh >= 120_000) {
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

export async function saveInvoice(
  invoice: Partial<Invoice> & { id: string; clientName: string; items: InvoiceItem[] }
): Promise<Invoice> {
  try {
    const saved = await api<Invoice>(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      body: JSON.stringify(invoice),
    });
    return saved;
  } catch (e) {
    // Offline or error: queue for sync
    await enqueueSync("invoice", "update", invoice);
    return invoice as Invoice;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await api(`/api/invoices/${id}`, { method: "DELETE" });
  } catch {
    await enqueueSync("invoice", "delete", { id });
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
          await db.clients.clear();
          await db.clients.bulkPut(data);
        } catch {}
      } else {
        const db = getDB();
        setClients(await db.clients.toArray());
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
      if (document.visibilityState === "visible" && navigator.onLine && now - lastFocusRefresh >= 120_000) {
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

export async function saveClient(
  client: Partial<Client> & { id: string; name: string }
): Promise<Client> {
  try {
    const saved = await api<Client>(`/api/clients/${client.id}`, {
      method: "PUT",
      body: JSON.stringify(client),
    });
    return saved;
  } catch {
    await enqueueSync("client", "update", client);
    return client as Client;
  }
}

export async function createClient(data: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<Client> {
  return api<Client>("/api/clients", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteClient(id: string): Promise<void> {
  try {
    await api(`/api/clients/${id}`, { method: "DELETE" });
  } catch {
    await enqueueSync("client", "delete", { id });
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
          await db.products.clear();
          await db.products.bulkPut(data);
        } catch {}
      } else {
        const db = getDB();
        setProducts(await db.products.toArray());
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
      if (document.visibilityState === "visible" && navigator.onLine && now - lastFocusRefresh >= 120_000) {
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
  return api<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function saveProduct(
  product: Partial<Product> & { id: string; name: string; category: string }
): Promise<Product> {
  try {
    const saved = await api<Product>(`/api/products/${product.id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    });
    return saved;
  } catch {
    await enqueueSync("product", "update", product);
    return product as Product;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
  } catch {
    await enqueueSync("product", "delete", { id });
  }
}

// ---------- Settings ----------

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

// ---------- Users (admin) ----------

export function useUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api<any[]>("/api/users"));
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { users, loading, refresh: load };
}

export async function updateUserRole(id: string, role: string) {
  return api(`/api/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserDisabled(id: string, disabled: boolean) {
  return api(`/api/users/${id}/disable`, {
    method: "PUT",
    body: JSON.stringify({ disabled }),
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
