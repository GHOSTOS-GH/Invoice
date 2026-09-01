"use client";
// Sticky banner showing offline status and pending sync count.

import { useSyncStatus } from "@/components/shared/sync-status";
import { WifiOff, RefreshCw, CloudUpload, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function OfflineBanner() {
  const { online, pending, syncing } = useSyncStatus();
  const [recentlySynced, setRecentlySynced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pending === 0 && !syncing && online) {
      timerRef.current = setTimeout(() => setRecentlySynced(false), 2500);
      // Defer the state update to avoid synchronous setState in effect
      Promise.resolve().then(() => setRecentlySynced(true));
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [pending, syncing, online]);

  if (!online) {
    return (
      <div className="sticky top-0 z-50 bg-amber-500 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
        <WifiOff className="w-4 h-4" />
        <span>Hors ligne — vos modifications seront synchronisées au retour du réseau</span>
        {pending > 0 && (
          <span className="ml-1 bg-white/25 rounded-full px-2 py-0.5 text-[11px]">
            {pending} en attente
          </span>
        )}
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="sticky top-0 z-50 bg-blue-600 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Synchronisation en cours…</span>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="sticky top-0 z-50 bg-blue-700 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
        <CloudUpload className="w-4 h-4" />
        <span>
          {pending} modification{pending > 1 ? "s" : ""} en attente de synchronisation
        </span>
      </div>
    );
  }

  if (recentlySynced) {
    return (
      <div className="sticky top-0 z-50 bg-green-600 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md transition-opacity">
        <CheckCircle2 className="w-4 h-4" />
        <span>Toutes les données sont synchronisées</span>
      </div>
    );
  }

  return null;
}
