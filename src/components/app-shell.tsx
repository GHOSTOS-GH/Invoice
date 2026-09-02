"use client";
// App shell: sidebar (desktop) + bottom nav (mobile), view switching,
// maintenance gate, and a sync/offline banner.

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "@/components/auth/login-screen";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { ROLE_META } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";
import {
  ReceiptText,
  PlusCircle,
  BarChart3,
  Settings as SettingsIcon,
  Package,
  Upload,
  Users,
  LogOut,
  Loader2,
  HardHat,
  ShieldAlert,
  LayoutDashboard,
  ShieldCheck,
  Briefcase,
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
  | "users";

interface NavItem {
  id: ViewId;
  label: string;
  icon: typeof ReceiptText;
  minRole: UserRole; // minimum role required
  mobileOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard, minRole: "employee" },
  { id: "invoices", label: "Factures", icon: ReceiptText, minRole: "employee" },
  { id: "new-invoice", label: "Nouvelle", icon: PlusCircle, minRole: "employee" },
  { id: "clients", label: "Clients", icon: Users, minRole: "employee" },
  { id: "stats", label: "Statistiques", icon: BarChart3, minRole: "employee" },
  { id: "products", label: "Produits", icon: Package, minRole: "admin" },
  { id: "csv-import", label: "Import CSV", icon: Upload, minRole: "employee" },
  { id: "settings", label: "Réglages", icon: SettingsIcon, minRole: "admin" },
  { id: "users", label: "Comptes", icon: Users, minRole: "admin" },
];

const MOBILE_NAV: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard, minRole: "employee" },
  { id: "invoices", label: "Factures", icon: ReceiptText, minRole: "employee" },
  { id: "new-invoice", label: "Nouvelle", icon: PlusCircle, minRole: "employee" },
  { id: "stats", label: "Stats", icon: BarChart3, minRole: "employee" },
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
  const { user, loading, logout } = useAuth();
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
    if (!user || user.role === "client") return;
    const onKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs/textarea/contenteditable
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      // Skip with modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const roleOk = (min: UserRole) => {
        const order: Record<UserRole, number> = { client: 0, employee: 1, admin: 2 };
        return order[user.role as UserRole] >= order[min];
      };

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
          else if (ev.key === "c" && roleOk("employee")) navigate("clients");
          else if (ev.key === "s" && roleOk("employee")) navigate("stats");
          else if (ev.key === "p" && roleOk("employee")) navigate("products");
        };
        window.addEventListener("keydown", handler, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handler), 800);
      } else if (e.key === "?") {
        // Show shortcuts help via toast handled elsewhere — just prevent default scroll
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

  // Maintenance gate: non-admin visitors see the closed screen
  if (maintenanceMode && user.role !== "admin") {
    return <MaintenanceScreen onLogout={logout} />;
  }

  // Clients have no business data access — show a friendly restricted screen
  if (user.role === "client") {
    return <ClientRestrictedScreen onLogout={logout} />;
  }

  const roleOrder: Record<UserRole, number> = { client: 0, employee: 1, admin: 2 };
  const visibleNav = NAV_ITEMS.filter((n) => roleOrder[user.role] >= roleOrder[n.minRole]);
  const visibleMobile = MOBILE_NAV.filter((n) => roleOrder[user.role] >= roleOrder[n.minRole]);

  return (
    <NavContext.Provider value={{ view, params, navigate }}>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <OfflineBanner />
        {/* Permanent mode indicator — impossible to confuse admin vs employee */}
        {user.role === "admin" ? (
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white text-[11px] font-bold tracking-wider px-4 py-1.5 flex items-center justify-center gap-2 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            Mode Administrateur — Accès total
            <button onClick={logout} aria-label="Se déconnecter" className="md:hidden ml-2 p-1 rounded hover:bg-white/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-emerald-600 text-white text-[11px] font-bold tracking-wider px-4 py-1.5 flex items-center justify-center gap-2 uppercase">
            <Briefcase className="w-3.5 h-3.5" />
            Mode Employé — Factures & Clients
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

function ClientRestrictedScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-6">
          <ShieldAlert className="w-12 h-12 text-slate-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-3">
          Accès limité
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Votre compte a le rôle « client ». Vous n'avez pas accès à la gestion
          des factures. Contactez un administrateur si vous pensez qu'il s'agit
          d'une erreur.
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
