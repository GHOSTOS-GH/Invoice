"use client";
// Écran « en attente de validation » — affiché à un compte client dont
// isApproved = false ou subscriptionStatus ≠ "active", juste après connexion,
// AVANT tout accès aux données métier (le serveur revérifie de toute façon
// via requireActiveClient sur chaque route sensible).
// Affiche un message clair et un bouton « J'ai effectué le paiement » branché
// sur POST /api/auth/payment-claim, avec retour visuel après clic.

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_META, SUBSCRIPTION_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatters";
import {
  ShieldAlert,
  LogOut,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Wallet,
  Store,
} from "lucide-react";

export function PendingApprovalScreen({
  user,
  onLogout,
  onRefresh,
}: {
  user: {
    name?: string | null;
    phone: string;
    isApproved: boolean;
    subscriptionStatus: string;
    paymentClaimedAt?: string | null;
  };
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<boolean>(!!user.paymentClaimedAt);
  const [error, setError] = useState<string | null>(null);

  const claimPayment = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/payment-claim", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Signalement impossible");
      setClaimed(true);
      await onRefresh();
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue");
    } finally {
      setClaiming(false);
    }
  };

  const suspended = user.isApproved && user.subscriptionStatus !== "active";
  const subMeta = SUBSCRIPTION_META[user.subscriptionStatus as keyof typeof SUBSCRIPTION_META];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
          >
            <Store className="w-8 h-8 text-white" />
          </div>
          <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mt-3">
            Facturier Konté
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7 sm:p-8 text-center">
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${
              suspended ? "bg-orange-100" : "bg-amber-100"
            }`}
          >
            {suspended ? (
              <ShieldAlert className="w-10 h-10 text-orange-500" />
            ) : (
              <Clock className="w-10 h-10 text-amber-500" />
            )}
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 mb-2">
            {suspended ? "Abonnement suspendu" : "Compte en attente de validation"}
          </h1>

          <p className="text-[14px] text-slate-500 leading-relaxed mb-5">
            {suspended ? (
              <>
                Bonjour <span className="font-semibold text-slate-700">{user.name || user.phone}</span>,
                votre abonnement est actuellement{" "}
                <span className="font-semibold">{subMeta?.label ?? user.subscriptionStatus}</span>.
                Contactez l&apos;administrateur de la plateforme pour rétablir votre accès.
              </>
            ) : (
              <>
                Bonjour <span className="font-semibold text-slate-700">{user.name || user.phone}</span>,
                votre compte a bien été créé. Il doit être validé par
                l&apos;administrateur avant de pouvoir accéder à vos factures,
                clients et produits.
              </>
            )}
          </p>

          {/* Statut du compte */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-5 text-left space-y-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Approbation du compte</span>
              <span
                className={`font-semibold ${user.isApproved ? "text-emerald-600" : "text-amber-600"}`}
              >
                {user.isApproved ? "Approuvé" : "En attente"}
              </span>
            </div>
            <div className="h-px bg-slate-200/70" />
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Abonnement</span>
              <span className={`font-semibold ${subMeta?.text ?? "text-slate-700"}`}>
                {subMeta?.label ?? user.subscriptionStatus}
              </span>
            </div>
            <div className="h-px bg-slate-200/70" />
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Paiement</span>
              <span className={claimed ? "font-semibold text-emerald-600" : "text-slate-500"}>
                {claimed
                  ? `Signalé${user.paymentClaimedAt ? ` le ${formatDateTime(user.paymentClaimedAt)}` : ""}`
                  : "Non signalé"}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-left">
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {/* Bouton de signalement de paiement */}
          {!claimed ? (
            <button
              onClick={claimPayment}
              disabled={claiming}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-5 py-3.5 shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-70"
            >
              {claiming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Wallet className="w-5 h-5" />
              )}
              J&apos;ai effectué le paiement
            </button>
          ) : (
            <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 flex items-center justify-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-[14px] font-semibold text-emerald-700">
                Paiement signalé, en attente de validation
              </p>
            </div>
          )}

          <p className="text-[12px] text-slate-400 mt-4 leading-relaxed">
            {claimed
              ? "L'administrateur a été notifié de votre paiement. Cette page se mettra à jour automatiquement après validation."
              : "Après paiement (virement, Wave, Orange Money…), cliquez sur le bouton ci-dessus pour informer l'administrateur."}
          </p>

          <button
            onClick={() => onRefresh()}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2563EB] hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Vérifier le statut de mon compte
          </button>
        </div>

        <div className="text-center mt-5">
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-slate-700"
          >
            <LogOut className="w-4 h-4" /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
