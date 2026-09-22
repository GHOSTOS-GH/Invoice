"use client";
// App shell : sidebar (desktop) + bottom nav (mobile), changement de vue,
// garde-fous d'accès (maintenance, compte non approuvé / abonnement inactif),
// et bannière de statut de sauvegarde en ligne.
// Modèle multi-tenant : deux rôles seulement — "superadmin" (plateforme)
// et "client" (boutique payante). Plus aucune notion d'employé/admin.

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "@/components/auth/login-screen";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PendingApprovalScreen } from "@/components/auth/pending-approval-screen";
import { ROLE_META } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import {
  ReceiptText,
  PlusCircle,
  BarChart3,
  Settings as SettingsIcon,
  Package,
  Upload,
  LogOut,
  Loader2,
  HardHat,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewId =
  | "dashboard"
  | "invoices"
  | "new-invoice"
  | "invoice-detail"
  | "clients"
  | "products"
  | "stats"
  | "settings"
  | "csv-import"
  | "superadmin";

interface NavItem {
  id: ViewId;
  label: string;
  icon: typeof ReceiptText;
  superadminOnly?: boolean;
  mobileOnly?: boolean;
}

// Navigation « boutique » : visible par tous les comptes clients actifs.
// L'écran superadmin est réservé au rôle superadmin.
const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard },
  { id: "invoices", label: "Factures", icon: ReceiptText },
  { id: "new-invoice", label: "Nouvelle", icon: PlusCircle },
  { id: "clients", label: "Clients", icon: Users },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
  { id: "products", label: "Produits", icon: Package },
  { id: "csv-import", label: "Import CSV", icon: Upload },
  { id: "settings", label: "Réglages", icon: SettingsIcon },
  { id: "superadmin", label: "Comptes", icon: ShieldCheck, superadminOnly: true },
];

const MOBILE_NAV: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard },
  { id: "invoices", label: "Factures", icon: ReceiptText },
  { id: "new-invoice", label: "Nouvelle", icon: PlusCircle },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

// Context for navigating between views + passing params (e.g. selected invoice id)
import { createContext, useContext } from "react";
interface NavCtx {
  view: ViewId;
  params: Record<string, any>;
  navigate: (view: ViewId, params?: Record<string, any>) => void;
}
export const NavContext = createContext<NavCtx | null>(null);
export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within AppShell");
  return ctx;
}

export function AppShell({
  children,
  maintenanceMode,
}: {
  children: React.ReactNode;
  maintenanceMode: boolean;
}) {
  const { user, loading, logout, refresh } = useAuth();
  const [view, setView] = useState<ViewId>("dashboard");
  const [params, setParams] = useState<Record<string, any>>({});

  const navigate = useCallback((v: ViewId, p: Record<string, any> = {}) => {
    setView(v);
    setParams(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Sync view with URL query param on mount (for PWA shortcuts)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const q = url.searchParams.get("view") as ViewId | null;
    if (q && NAV_ITEMS.some((n) => n.id === q)) {
      // Defer to avoid synchronous setState in effect
      Promise.resolve().then(() => setView(q));
      url.searchParams.delete("view");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Global keyboard shortcuts (only when authenticated, not in inputs)
  useEffect(() => {
    if (!user || user.role !== "client") return;
    const onKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs/textarea/contenteditable
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      // Skip with modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n") {
        e.preventDefault();
        navigate("new-invoice");
      } else if (e.key === "/") {
        e.preventDefault();
        navigate("invoices");
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('input[placeholder*="Rechercher"]')?.focus();
        }, 60);
      } else if (e.key === "g") {
        // "g" then next key: g+d dashboard, g+i invoices, g+c clients, g+s stats, g+p products
        const handler = (ev: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          if (ev.key === "d") navigate("dashboard");
          else if (ev.key === "i") navigate("invoices");
          else if (ev.key === "c") navigate("clients");
          else if (ev.key === "s") navigate("stats");
          else if (ev.key === "p") navigate("products");
        };
        window.addEventListener("keydown", handler, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handler), 800);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // === GARDE-FOU : compte client non approuvé ou abonnement non actif ===
  // Aucun accès aux données métier tant que le compte n'est pas validé.
  // (Le serveur revérifie systématiquement via requireActiveClient.)
  if (user.role === "client" && (!user.isApproved || user.subscriptionStatus !== "active")) {
    return <PendingApprovalScreen user={user} onLogout={logout} onRefresh={refresh} />;
  }

  // Maintenance gate: non-superadmin visitors see the closed screen
  if (maintenanceMode && user.role !== "superadmin") {
    return <MaintenanceScreen onLogout={logout} />;
  }

  const visibleNav = NAV_ITEMS.filter((n) =>
    n.superadminOnly ? user.role === "superadmin" : user.role === "client"
  );
  const visibleMobile = MOBILE_NAV;

  return (
    <NavContext.Provider value={{ view, params, navigate }}>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <OfflineBanner />
        {/* Bandeau de mode permanent — clair et impossible à confondre */}
        {user.role === "superadmin" ? (
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white text-[11px] font-bold tracking-wider px-4 py-1.5 flex items-center justify-center gap-2 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            Superadmin — Gestion de la plateforme
            <button onClick={logout} aria-label="Se déconnecter" className="md:hidden ml-2 p-1 rounded hover:bg-white/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[11px] font-bold tracking-wider px-4 py-1.5 flex items-center justify-center gap-2 uppercase">
            <Store className="w-3.5 h-3.5" />
            Espace Boutique
            <button onClick={logout} aria-label="Se déconnecter" className="md:hidden ml-2 p-1 rounded hover:bg-white/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-60 lg:w-64 flex-col border-r border-slate-200 bg-white shrink-0 sticky top-0 h-screen">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
                >
                  <ReceiptText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-[15px] leading-tight truncate">
                    Facturier
                  </p>
                  <p className="text-[11px] text-slate-400 leading-tight">Konté Services</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                      active
                        ? "bg-[#2563EB] text-white shadow-sm shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-100 space-y-2">
              <div className="hidden lg:block px-3 py-2 rounded-xl bg-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Raccourcis
                </p>
                <div className="space-y-1 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>Nouvelle facture</span>
                    <kbd className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5">N</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Rechercher</span>
                    <kbd className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5">/</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Navigation</span>
                    <kbd className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5">G+…</kbd>
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-50">
                <p className="text-[12px] font-semibold text-slate-700 truncate">
                  {user.name || user.phone}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user.phone}</p>
                <span
                  className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: ROLE_META[user.role as UserRole].color }}
                >
                  {ROLE_META[user.role as UserRole].label}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span>Déconnexion</span>
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-4 safe-area-inset-bottom">
          {visibleMobile.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
                  active ? "text-[#2563EB]" : "text-slate-400"
                )}
              >
                <Icon className="w-[22px] h-[22px]" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </NavContext.Provider>
  );
}

function MaintenanceScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <HardHat className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-3">
          Site actuellement fermé
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Le service est temporairement indisponible pour maintenance.
          Veuillez réessayer plus tard.
        </p>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
