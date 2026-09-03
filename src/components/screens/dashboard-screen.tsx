"use client";
// Dashboard / home overview — welcome card, quick KPIs, recent invoices,
// status distribution, and quick action shortcuts.

import { useMemo } from "react";
import { useInvoices, useProducts, useClients } from "@/lib/data-hooks";
import { useAuth } from "@/lib/auth-context";
import { useNav } from "@/components/app-shell";
import { ScreenHeader, StatusBadge, LoadingState, EmptyState } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PlusCircle,
  ReceiptText,
  TrendingUp,
  Package,
  Users,
  ArrowRight,
  Calendar,
  Wallet,
  ShoppingBag,
  Clock,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Settings as SettingsIcon,
  Upload,
} from "lucide-react";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/constants";
import { formatCurrency, formatDateTime, refId, formatShortDay } from "@/lib/formatters";
import {
  invoiceTotal,
  invoicePayableTotal,
  invoiceTotalQuantity,
} from "@/lib/types";
import type { Invoice } from "@/lib/types";

export function DashboardScreen() {
  const { invoices, loading } = useInvoices();
  const { products } = useProducts();
  const { clients } = useClients();
  const { user } = useAuth();
  const { navigate } = useNav();

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const todayInvoices = invoices.filter((i) => new Date(i.createdAt) >= todayStart);
    const weekInvoices = invoices.filter((i) => new Date(i.createdAt) >= weekStart);

    const isRevenue = (invoice: Invoice) => invoice.status === "enLivraison" || invoice.status === "livree";
    const caToday = todayInvoices.filter(isRevenue).reduce((s, i) => s + invoiceTotal(i.items), 0);
    const caWeek = weekInvoices.filter(isRevenue).reduce((s, i) => s + invoiceTotal(i.items), 0);
    const caAll = invoices.filter(isRevenue).reduce((s, i) => s + invoiceTotal(i.items), 0);

    const statusCounts: Record<InvoiceStatus, number> = {
      enCours: 0,
      enLivraison: 0,
      livree: 0,
    };
    for (const inv of invoices) statusCounts[inv.status]++;

    const recent = [...invoices]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      caToday,
      caWeek,
      caAll,
      todayCount: todayInvoices.length,
      weekCount: weekInvoices.length,
      statusCounts,
      recent,
    };
  }, [invoices]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const months = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  if (loading) return <LoadingState message="Chargement du tableau de bord…" />;

  return (
    <div>
      <ScreenHeader
        title="Accueil"
        subtitle={today}
        icon={LayoutDashboard}
        actions={
          <Button
            size="sm"
            onClick={() => navigate("new-invoice")}
            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" /> Nouvelle facture
          </Button>
        }
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
        {/* Welcome hero card */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-7 text-white shadow-lg shadow-blue-500/20"
          style={{
            background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 55%, #1E3A8A 100%)",
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-blue-300/15 blur-2xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-white/80">
                {greeting}
              </span>
            </div>
            <h2 className="text-2xl sm:text-[28px] font-extrabold mb-1">
              {user?.name || user?.phone}
            </h2>
            <p className="text-[13px] text-white/70 mb-5">
              Voici un résumé de votre activité aujourd&apos;hui
            </p>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-3.5 border border-white/15">
                <div className="flex items-center gap-1.5 text-white/70 mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
                    CA Aujourd&apos;hui
                  </span>
                </div>
                <p className="text-base sm:text-lg font-extrabold leading-tight tabular-nums">
                  {formatCurrency(stats.caToday)}
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/60 mt-0.5">
                  {stats.todayCount} facture{stats.todayCount > 1 ? "s" : ""}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-3.5 border border-white/15">
                <div className="flex items-center gap-1.5 text-white/70 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
                    7 jours
                  </span>
                </div>
                <p className="text-base sm:text-lg font-extrabold leading-tight tabular-nums">
                  {formatCurrency(stats.caWeek)}
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/60 mt-0.5">
                  {stats.weekCount} facture{stats.weekCount > 1 ? "s" : ""}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-3.5 border border-white/15">
                <div className="flex items-center gap-1.5 text-white/70 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
                    Total
                  </span>
                </div>
                <p className="text-base sm:text-lg font-extrabold leading-tight tabular-nums">
                  {formatCurrency(stats.caAll)}
                </p>
                <p className="text-[10px] sm:text-[11px] text-white/60 mt-0.5">
                  {invoices.length} au total
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin icon tiles — large clickable cards for admin-only screens */}
        {user?.role === "admin" && (
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" /> Espace Administration
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <AdminTile
                icon={BarChart3}
                label="Statistiques"
                description="CA & graphiques"
                color="#6366F1"
                onClick={() => navigate("stats")}
              />
              <AdminTile
                icon={Package}
                label="Produits"
                description="Catalogue"
                color="#D97706"
                onClick={() => navigate("products")}
              />
              <AdminTile
                icon={Users}
                label="Comptes"
                description="Utilisateurs"
                color="#2563EB"
                onClick={() => navigate("users")}
              />
              <AdminTile
                icon={SettingsIcon}
                label="Réglages"
                description="Boutique & maintenance"
                color="#DB2777"
                onClick={() => navigate("settings")}
              />
              <AdminTile
                icon={Upload}
                label="Import CSV"
                description="Importer des factures"
                color="#16A34A"
                onClick={() => navigate("csv-import")}
              />
            </div>
          </div>
        )}

        {/* Quick action cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            icon={PlusCircle}
            label="Nouvelle facture"
            color="#2563EB"
            onClick={() => navigate("new-invoice")}
          />
          <QuickAction
            icon={ReceiptText}
            label="Voir factures"
            color="#16A34A"
            onClick={() => navigate("invoices")}
          />
          <QuickAction
            icon={Package}
            label="Produits"
            color="#D97706"
            onClick={() => navigate("products")}
          />
          <QuickAction
            icon={TrendingUp}
            label="Statistiques"
            color="#DB2777"
            onClick={() => navigate("stats")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent invoices (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-[15px] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2563EB]" /> Factures récentes
              </h3>
              <button
                onClick={() => navigate("invoices")}
                className="text-[12px] font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                Tout voir <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {stats.recent.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Aucune facture"
                description="Créez votre première facture pour la voir ici"
                action={
                  <Button
                    onClick={() => navigate("new-invoice")}
                    className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
                    size="sm"
                  >
                    <PlusCircle className="w-4 h-4 mr-1.5" /> Créer
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {stats.recent.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate("invoice-detail", { invoiceId: inv.id })}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: INVOICE_STATUS_META[inv.status].color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-slate-900 text-[14px] truncate">
                          {inv.clientName}
                        </p>
                        <StatusBadge status={inv.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-mono">{refId(inv.id)}</span>
                        <span>·</span>
                        <span>{formatDateTime(inv.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-slate-900 text-[14px] tabular-nums">
                        {formatCurrency(invoicePayableTotal(inv))}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {inv.items.length} art.
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status distribution + catalog stats (1 col) */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-bold text-slate-900 text-[15px] mb-4 flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-[#2563EB]" /> Par statut
              </h3>
              <div className="space-y-2.5">
                {INVOICE_STATUSES.map((s) => {
                  const meta = INVOICE_STATUS_META[s];
                  const count = stats.statusCounts[s];
                  const pct = invoices.length > 0 ? (count / invoices.length) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-[12.5px] font-medium text-slate-700">
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-bold text-slate-900 text-[15px] mb-3 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#2563EB]" /> Catalogue
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <CatalogStat
                  icon={Package}
                  label="Produits"
                  value={products.length}
                  color="#D97706"
                />
                <CatalogStat
                  icon={Users}
                  label="Clients"
                  value={clients.length}
                  color="#16A34A"
                />
                <CatalogStat
                  icon={ReceiptText}
                  label="Factures"
                  value={invoices.length}
                  color="#2563EB"
                />
                <CatalogStat
                  icon={ShoppingBag}
                  label="Articles vendus"
                  value={invoices.reduce(
                    (s, i) => s + invoiceTotalQuantity(i.items),
                    0
                  )}
                  color="#6366F1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-[12.5px] font-semibold text-slate-700 text-center leading-tight">
        {label}
      </span>
    </button>
  );
}

function CatalogStat({
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
    <div className="bg-slate-50 rounded-xl p-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function AdminTile({
  icon: Icon,
  label,
  description,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col items-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all"
      style={{ borderRadius: 16 }}
    >
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
        style={{ backgroundColor: `${color}1A`, borderRadius: 16 }}
      >
        <Icon className="w-7 h-7 sm:w-8 sm:h-8" style={{ color }} />
      </div>
      <div className="text-center">
        <p className="font-bold text-slate-900 text-[14px]">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
