"use client";
// Bannière de statut de sauvegarde en ligne — modèle simplifié :
// - en ligne + rien en attente  : « Toutes les données sont sauvegardées en ligne »
// - en ligne + N en attente     : N données « non sauvegardées en ligne » + bouton « Réessayer »
// - hors ligne                  : les modifications restent locales, bouton « Réessayer » au retour

import { useSyncStatus } from "@/components/shared/sync-status";
import { WifiOff, RefreshCw, CloudUpload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function OfflineBanner() {
  const { online, pending, retrying, forceSync } = useSyncStatus();
  const [justSaved, setJustSaved] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryingLocal, setRetryingLocal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    // Un envoi réussi vient de faire chuter le compteur : feedback positif bref
    if (prevPending.current > 0 && pending === 0 && online && !retrying) {
      setJustSaved(true);
      timerRef.current = setTimeout(() => setJustSaved(false), 2500);
    }
    prevPending.current = pending;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pending, retrying, online]);

  const requestRetry = async () => {
    if (retryingLocal) return;
    setRetryingLocal(true);
    setRetryMessage(null);
    try {
      const r = await forceSync();
      if (r.failed > 0) {
        setRetryMessage(r.message ? `Échec : ${r.message}` : "Certains envois ont échoué");
      } else if (r.ok > 0) {
        setRetryMessage(null);
        window.dispatchEvent(new Event("invoice-sync-request"));
      }
    } catch {
      setRetryMessage("Réessai impossible pour le moment");
    } finally {
      setRetryingLocal(false);
    }
  };

  const RetryButton = ({ light = true }: { light?: boolean }) => (
    <button
      onClick={requestRetry}
      disabled={retryingLocal}
      className={`ml-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-70 ${
        light ? "bg-white/15 hover:bg-white/25 text-white" : "bg-slate-900/10 hover:bg-slate-900/20 text-slate-700"
      }`}
      aria-label="Réessayer la sauvegarde en ligne"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${retryingLocal || retrying ? "animate-spin" : ""}`} />
      {retryingLocal || retrying ? "Envoi…" : "Réessayer"}
    </button>
  );

  // Hors ligne : tout fonctionne en local, certaines données ne sont pas encore en ligne
  if (!online) {
    return (
      <div className="sticky top-0 z-50 bg-amber-500 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 flex-wrap shadow-md">
        <WifiOff className="w-4 h-4" />
        <span>
          Hors ligne — {pending > 0
            ? `${pending} donnée${pending > 1 ? "s" : ""} non sauvegardée${pending > 1 ? "s" : ""} en ligne`
            : "fonctionnement local"}
        </span>
        {pending > 0 && <RetryButton />}
      </div>
    );
  }

  // Envoi en cours
  if (retrying || retryingLocal) {
    return (
      <div className="sticky top-0 z-50 bg-blue-600 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Sauvegarde en ligne en cours…</span>
      </div>
    );
  }

  // En ligne mais des données restent uniquement locales
  if (pending > 0) {
    return (
      <div className="sticky top-0 z-50 bg-orange-500 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 flex-wrap shadow-md">
        <AlertTriangle className="w-4 h-4" />
        <span>
          {pending} donnée{pending > 1 ? "s" : ""} enregistrée{pending > 1 ? "s" : ""} localement, non sauvegardée
          {pending > 1 ? "s" : ""} en ligne
        </span>
        <RetryButton />
        {retryMessage && (
          <span className="text-[11px] bg-white/20 rounded-lg px-2 py-0.5">{retryMessage}</span>
        )}
      </div>
    );
  }

  // Tout est sauvegardé en ligne
  if (justSaved) {
    return (
      <div className="sticky top-0 z-50 bg-emerald-600 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md transition-opacity">
        <CheckCircle2 className="w-4 h-4" />
        <span>Sauvegardé en ligne</span>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 bg-emerald-600/95 text-white text-[13px] font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
      <CheckCircle2 className="w-4 h-4" />
      <span>Toutes les données sont sauvegardées en ligne</span>
      <button
        onClick={() => {
          window.dispatchEvent(new Event("invoice-sync-request"));
        }}
        className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[12px] hover:bg-white/25"
        aria-label="Rafraîchir depuis le serveur"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Actualiser
      </button>
    </div>
  );
}
