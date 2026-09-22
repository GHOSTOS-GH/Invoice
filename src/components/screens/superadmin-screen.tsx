"use client";
// Tableau de bord plateforme — SUPERADMIN UNIQUEMENT.
// Liste tous les comptes clients : nom/téléphone, date d'inscription,
// statut d'approbation, statut d'abonnement, badge « Paiement signalé le [date] »,
// et actions rapides branchées sur /api/superadmin/users.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScreenHeader, LoadingState, EmptyState } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  RotateCcw,
  Wallet,
  Store,
  Phone,
  CalendarDays,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { SUBSCRIPTION_META, type SubscriptionStatus } from "@/lib/constants";
import type { User } from "@/lib/types";

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

export function SuperadminScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ user: User; action: "reset" | "disable" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ users: User[] }>("/api/superadmin/users");
      setUsers(data.users);
    } catch (e: any) {
      toast.error(e.message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (id: string, action: string, label: string) => {
      setBusyId(id);
      try {
        const data = await api<{ user: User }>(`/api/superadmin/users/${id}`, {
          method: "PUT",
          body: JSON.stringify({ action }),
        });
        setUsers((current) => current.map((u) => (u.id === id ? data.user : u)));
        toast.success(label);
      } catch (e: any) {
        toast.error(e.message || "Action impossible");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
    );
  }, [users, search]);

  const counts = useMemo(
    () => ({
      total: users.filter((u) => u.role === "client").length,
      pending: users.filter((u) => u.role === "client" && !u.isApproved).length,
      paymentClaimed: users.filter((u) => u.role === "client" && u.paymentClaimedAt).length,
      active: users.filter((u) => u.role === "client" && u.isApproved && u.subscriptionStatus === "active" && !u.disabled).length,
    }),
    [users]
  );

  if (loading) return <LoadingState message="Chargement des comptes…" />;

  return (
    <div>
      <ScreenHeader
        title="Gestion des comptes"
        subtitle="Plateforme — tous les comptes boutiques"
        icon={ShieldCheck}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="rounded-xl h-9"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        }
      />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        {/* Résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile icon={Users} label="Comptes boutiques" value={counts.total} color="#2563EB" />
          <SummaryTile icon={Clock} label="En attente" value={counts.pending} color="#F59E0B" />
          <SummaryTile icon={Wallet} label="Paiements signalés" value={counts.paymentClaimed} color="#7C3AED" />
          <SummaryTile icon={CheckCircle2} label="Actifs" value={counts.active} color="#16A34A" />
        </div>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            className="h-10 rounded-xl pl-9 border-slate-200"
          />
        </div>

        {/* Liste des comptes */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={users.length === 0 ? "Aucun compte client" : "Aucun résultat"}
            description={
              users.length === 0
                ? "Les comptes créés via l'inscription apparaîtront ici."
                : "Aucun compte ne correspond à cette recherche."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => {
              const busy = busyId === u.id;
              const subMeta = SUBSCRIPTION_META[u.subscriptionStatus as SubscriptionStatus];
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5"
                >
                  {/* En-tête compte */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
                    >
                      <span className="text-white font-bold text-[14px]">
                        {(u.name || u.phone).trim().charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-[15px] truncate">
                          {u.name || u.phone}
                        </p>
                        {u.role === "superadmin" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wide">
                            Superadmin
                          </span>
                        )}
                        {u.disabled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wide">
                            Désactivé
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[12px] text-slate-400 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {u.phone}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> Inscrit le {formatDateTime(u.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges statut */}
                  <div className="flex items-center gap-2 flex-wrap mt-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                        u.isApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {u.isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {u.isApproved ? "Approuvé" : "Non approuvé"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full",
                        subMeta?.bg ?? "bg-slate-100",
                        subMeta?.text ?? "text-slate-600"
                      )}
                    >
                      Abonnement : {subMeta?.label ?? u.subscriptionStatus}
                    </span>
                    {u.paymentClaimedAt && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                        <Wallet className="w-3.5 h-3.5" />
                        Paiement signalé le {formatDateTime(u.paymentClaimedAt)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {u.role !== "superadmin" && (
                    <div className="flex items-center gap-2 flex-wrap mt-4 pt-3.5 border-t border-slate-100">
                      {!u.isApproved ? (
                        <ActionButton
                          icon={CheckCircle2}
                          label="Approuver"
                          color="emerald"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => runAction(u.id, "approve", `${u.name || u.phone} approuvé`)}
                        />
                      ) : (
                        <ActionButton
                          icon={RotateCcw}
                          label="Repasser en attente"
                          color="slate"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => setConfirmAction({ user: u, action: "reset" })}
                        />
                      )}
                      {u.subscriptionStatus === "active" ? (
                        <ActionButton
                          icon={PauseCircle}
                          label="Suspendre l'abonnement"
                          color="orange"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => runAction(u.id, "suspend", "Abonnement suspendu")}
                        />
                      ) : (
                        <ActionButton
                          icon={PlayCircle}
                          label="Activer l'abonnement"
                          color="emerald"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => runAction(u.id, "activate", "Abonnement activé")}
                        />
                      )}
                      {!u.disabled ? (
                        <ActionButton
                          icon={Ban}
                          label="Désactiver le compte"
                          color="red"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => setConfirmAction({ user: u, action: "disable" })}
                        />
                      ) : (
                        <ActionButton
                          icon={PlayCircle}
                          label="Réactiver le compte"
                          color="emerald"
                          busy={busy}
                          disabled={busyId !== null}
                          onClick={() => runAction(u.id, "enable", "Compte réactivé")}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation des actions irréversibles / sensibles */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "disable"
                ? "Désactiver ce compte ?"
                : "Repasser ce compte en attente ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "disable" ? (
                <>
                  <span className="font-semibold text-slate-700">
                    {confirmAction.user.name || confirmAction.user.phone}
                  </span>{" "}
                  perdra immédiatement tout accès (déconnexion forcée à la prochaine
                  requête). Vous pourrez le réactiver à tout moment.
                </>
              ) : (
                <>
                  Le compte de{" "}
                  <span className="font-semibold text-slate-700">
                    {confirmAction?.user.name || confirmAction?.user.phone}
                  </span>{" "}
                  retournera en attente (abonnement « en attente », signalement de
                  paiement effacé). Il devra être approuvé à nouveau.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.action === "disable") {
                  runAction(confirmAction.user.id, "disable", "Compte désactivé");
                } else {
                  runAction(confirmAction.user.id, "reset", "Compte repassé en attente");
                }
                setConfirmAction(null);
              }}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  busy,
  disabled,
  onClick,
}: {
  icon: any;
  label: string;
  color: "emerald" | "orange" | "red" | "slate";
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
    orange: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
    red: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
    slate: "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-50",
        colors[color]
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
