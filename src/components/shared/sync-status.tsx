"use client";
// Tracks online/offline status + pending sync count, exposes via context.
// Also starts the sync engine on mount.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeSync, startSyncEngine, pullFromServer, flushQueue, type SyncAttemptResult } from "@/lib/sync-engine";
import { countPendingSync } from "@/lib/offline-db";

interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  refresh: () => void;
  forceSync: () => Promise<SyncAttemptResult[]>;
}

const Ctx = createContext<SyncStatus | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void pullFromServer();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    startSyncEngine();
    const unsub = subscribeSync((p, s) => {
      setPending(p);
      setSyncing(s);
    });
    countPendingSync().then(setPending);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, []);

  const refresh = () => {
    countPendingSync().then(setPending);
  };

  const forceSync = async () => {
    const results = await flushQueue();
    refresh();
    return results;
  };

  return (
    <Ctx.Provider value={{ online, pending, syncing, refresh, forceSync }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSyncStatus() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSyncStatus must be used within SyncStatusProvider");
  return ctx;
}
