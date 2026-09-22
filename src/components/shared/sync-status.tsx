"use client";
// Tracks online/offline status + pending local-only count, exposes via context.
// Also starts the (simplified) sync engine on mount.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeSync, startSyncEngine, pullFromServer, retryPendingSync } from "@/lib/sync-engine";
import { countPendingLocal } from "@/lib/offline-db";

interface SyncStatus {
  online: boolean;
  pending: number;
  retrying: boolean;
  refresh: () => void;
  forceSync: () => Promise<{ ok: number; failed: number; message?: string }>;
}

const Ctx = createContext<SyncStatus | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void pullFromServer();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    startSyncEngine();
    const unsub = subscribeSync((p, r) => {
      setPending(p);
      setRetrying(r);
    });
    countPendingLocal().then(setPending);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, []);

  const refresh = () => {
    countPendingLocal().then(setPending);
  };

  const forceSync = async () => {
    const results = await retryPendingSync();
    refresh();
    return results;
  };

  return (
    <Ctx.Provider value={{ online, pending, retrying, refresh, forceSync }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSyncStatus() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSyncStatus must be used within SyncStatusProvider");
  return ctx;
}
