"use client";
// Statistics dashboard — reproduces stats_screen.dart:
// Period selector, CA hero, 4 KPI cards, CA evolution bar chart,
// status répartition donut chart, Top 5 clients, Top 5 produits.

import { useState, useMemo, useCallback } from "react";
import { useInvoices } from "@/lib/data-hooks";
import {
  ScreenHeader,
  EmptyState,
  SectionCard,
} from "@/components/shared/ui";
import {
  formatCurrency,
  formatShortDay,
  formatMonthYear,
  formatNumber,
} from "@/lib/formatters";
import {
  invoiceTotal,
  invoiceTotalQuantity,
  type Invoice,
} from "@/lib/types";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUSES,
} from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import {
  ReceiptText,
  ShoppingCart,
  Package,
  Award,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "week" | "month" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "7 jours" },
  { id: "month", label: "30 jours" },
  { id: "all", label: "Tout" },
];

// Rank badge colors for Top 5 lists
const RANK_COLORS = ["#2563EB", "#6366F1", "#8B5CF6", "#0EA5E9", "#14B8A6"];

// ---------- Pure helpers (mirror stats_screen.dart) ----------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function filterByPeriod(invoices: Invoice[], period: Period): Invoice[] {
  if (period === "all") return invoices;
  const days = period === "week" ? 7 : 30;
  const cutoff = startOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return invoices.filter(
    (inv) => startOfDay(new Date(inv.createdAt)) >= cutoff
  );
}

interface SeriesPoint {
  label: string;
  value: number;
}

function buildCaSeries(invoices: Invoice[], period: Period): SeriesPoint[] {
  if (period === "all") {
    // Group by month, sorted chronologically from earliest invoice month.
    const map = new Map<string, { date: Date; total: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = map.get(key);
      const t = invoiceTotal(inv.items);
      if (existing) {
        existing.total += t;
      } else {
        map.set(key, {
          date: new Date(d.getFullYear(), d.getMonth(), 1),
          total: t,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((v) => ({ label: formatMonthYear(v.date), value: v.total }));
  }

  // Daily buckets for last 7 or 30 days.
  const days = period === "week" ? 7 : 30;
  const today = startOfDay(new Date());
  const buckets: { date: Date; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, total: 0 });
  }
  for (const inv of invoices) {
    const d = startOfDay(new Date(inv.createdAt));
    const idx = buckets.findIndex((b) => b.date.getTime() === d.getTime());
    if (idx >= 0) buckets[idx].total += invoiceTotal(inv.items);
  }
  return buckets.map((v) => ({ label: formatShortDay(v.date), value: v.total }));
}

interface StatusSlice {
  status: string;
  label: string;
  color: string;
  value: number;
}

function buildStatusRepartition(invoices: Invoice[]): StatusSlice[] {
  return INVOICE_STATUSES.map((status) => {
    const total = invoices
      .filter((inv) => inv.status === status)
      .reduce((s, inv) => s + invoiceTotal(inv.items), 0);
    return {
      status,
      label: INVOICE_STATUS_META[status].label,
      color: INVOICE_STATUS_META[status].color,
      value: total,
    };
  }).filter((s) => s.value > 0);
}

interface RankEntry {
  name: string;
  value: number;
}

function buildTopClients(invoices: Invoice[]): RankEntry[] {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    const t = invoiceTotal(inv.items);
    map.set(inv.clientName, (map.get(inv.clientName) ?? 0) + t);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildTopProducts(invoices: Invoice[]): RankEntry[] {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    for (const item of inv.items ?? []) {
      map.set(item.name, (map.get(item.name) ?? 0) + item.quantity);
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

// ---------- Presentational sub-components ----------

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sélection de la période"
      className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-full shadow-sm"
    >
      {PERIODS.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            className={
              "px-4 py-1.5 text-[13px] font-semibold rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 " +
              (active
                ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50")
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5"
        style={{
          background: `linear-gradient(135deg, ${color}26, ${color}0D)`,
          color,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold truncate">
        {label}
      </p>
      <p className="text-[15px] font-bold text-slate-900 truncate tabular-nums">
        {value}
      </p>
    </div>
  );
}

function CaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-[13px] font-bold text-slate-900 tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: StatusSlice;
  }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: p.payload.color }}
        />
        <p className="text-[12px] font-semibold text-slate-800">{p.name}</p>
      </div>
      <p className="text-[12px] text-slate-900 font-bold tabular-nums">
        {formatCurrency(p.value)}
      </p>
    </div>
  );
}

function RankedRow({
  index,
  name,
  valueLabel,
  pct,
}: {
  index: number;
  name: string;
  valueLabel: string;
  pct: number;
}) {
  const color = RANK_COLORS[index % RANK_COLORS.length];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm"
        style={{ background: color }}
        aria-hidden="true"
      >
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[13px] font-semibold text-slate-800 truncate">
            {name}
          </p>
          <p className="text-[12px] font-bold text-slate-900 shrink-0 tabular-nums">
            {valueLabel}
          </p>
        </div>
        <div
          className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center sm:justify-start">
        <Skeleton className="h-9 w-72 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

// ---------- Main screen ----------

export function StatsScreen() {
  const { invoices, loading, refresh } = useInvoices();
  const [period, setPeriod] = useState<Period>("week");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      toast.success("Statistiques actualisées");
    } catch {
      toast.error("Impossible d'actualiser les statistiques");
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const stats = useMemo(() => {
    const filtered = filterByPeriod(invoices, period);
    const revenueInvoices = filtered.filter(
      (inv) => inv.status === "enLivraison" || inv.status === "livree"
    );
    const totalCA = revenueInvoices.reduce((s, inv) => s + invoiceTotal(inv.items), 0);
    const factureCount = revenueInvoices.length;
    const articlesVendus = revenueInvoices.reduce(
      (s, inv) => s + invoiceTotalQuantity(inv.items),
      0
    );
    const panierMoyen = factureCount > 0 ? totalCA / factureCount : 0;
    const plusGrosse = revenueInvoices.reduce(
      (m, inv) => Math.max(m, invoiceTotal(inv.items)),
      0
    );
    const caSeries = buildCaSeries(revenueInvoices, period);
    const statusRep = buildStatusRepartition(filtered);
    const topClients = buildTopClients(revenueInvoices);
    const topProducts = buildTopProducts(revenueInvoices);
    return {
      filtered,
      totalCA,
      factureCount,
      articlesVendus,
      panierMoyen,
      plusGrosse,
      caSeries,
      statusRep,
      topClients,
      topProducts,
    };
  }, [invoices, period]);

  const maxClient = stats.topClients[0]?.value ?? 0;
  const maxProduct = stats.topProducts[0]?.value ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ScreenHeader
        title="Statistiques"
        subtitle="Chiffre d'affaires et performances"
        icon={BarChart3}
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Actualiser les statistiques"
            className="h-9 w-9 rounded-xl border-slate-200"
          >
            <RefreshCw
              className={"w-4 h-4 " + (refreshing ? "animate-spin" : "")}
            />
          </Button>
        }
      />

      <main className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {loading ? (
          <StatsSkeleton />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Aucune donnée à afficher"
            description="Vos statistiques apparaîtront ici dès que vous aurez créé des factures."
          />
        ) : (
          <>
            {/* Period selector */}
            <div className="flex justify-center sm:justify-start">
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {/* Hero CA card */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white shadow-lg shadow-blue-500/25"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              }}
            >
              {/* Decorative circles */}
              <div
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-16 -right-4 w-32 h-32 rounded-full bg-white/5 pointer-events-none"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="w-4 h-4 text-white/80" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    Chiffre d&apos;affaires
                  </p>
                </div>
                <p className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-none mb-2 tabular-nums">
                  {formatCurrency(stats.totalCA)}
                </p>
                <p className="text-[12px] sm:text-[13px] text-white/80">
                  {stats.factureCount} facture
                  {stats.factureCount > 1 ? "s" : ""} · {stats.articlesVendus}{" "}
                  article{stats.articlesVendus > 1 ? "s" : ""}
                </p>
                <p className="mt-1 text-[11px] text-white/65">
                  Factures en livraison ou livrées uniquement
                </p>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                icon={ReceiptText}
                label="Factures"
                value={formatNumber(stats.factureCount)}
                color="#6366F1"
              />
              <KpiCard
                icon={ShoppingCart}
                label="Panier moyen"
                value={formatCurrency(stats.panierMoyen)}
                color="#16A34A"
              />
              <KpiCard
                icon={Package}
                label="Articles vendus"
                value={formatNumber(stats.articlesVendus)}
                color="#D97706"
              />
              <KpiCard
                icon={Award}
                label="Plus grosse facture"
                value={formatCurrency(stats.plusGrosse)}
                color="#DB2777"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CA evolution bar chart */}
              <SectionCard
                title="Évolution du chiffre d'affaires"
                action={
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {period === "all" ? "Mensuel" : "Quotidien"}
                  </span>
                }
              >
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.caSeries}
                      margin={{ top: 10, right: 4, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="caBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#2563EB" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#EEF2F7"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#94A3B8" }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                        interval={
                          period === "month" ? 3 : period === "week" ? 0 : 0
                        }
                        minTickGap={6}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94A3B8" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={(v: number) =>
                          v >= 1000
                            ? `${Math.round(v / 1000)}k`
                            : String(Math.round(v))
                        }
                      />
                      <Tooltip
                        content={<CaTooltip />}
                        cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                      />
                      <Bar
                        dataKey="value"
                        fill="url(#caBar)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={
                          period === "all" ? 40 : period === "week" ? 32 : 14
                        }
                        accessibilityLayer
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              {/* Status répartition donut */}
              <SectionCard title="Répartition par statut">
                {stats.statusRep.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-[13px] text-slate-400">
                    Aucune facture sur cette période
                  </div>
                ) : (
                  <div>
                    <div className="relative h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.statusRep}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={2}
                            stroke="none"
                            accessibilityLayer
                          >
                            {stats.statusRep.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={entry.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center label overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                          Total
                        </p>
                        <p className="text-[14px] font-bold text-slate-900 leading-tight tabular-nums px-2 text-center">
                          {formatCurrency(stats.totalCA)}
                        </p>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                      {stats.statusRep.map((entry) => {
                        const pct =
                          stats.totalCA > 0
                            ? Math.round((entry.value / stats.totalCA) * 100)
                            : 0;
                        return (
                          <div
                            key={entry.status}
                            className="flex items-center gap-2 text-[12px]"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: entry.color }}
                              aria-hidden="true"
                            />
                            <span className="text-slate-600 truncate flex-1">
                              {entry.label}
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {pct}%
                            </span>
                            <span className="text-slate-400 tabular-nums w-24 text-right truncate">
                              {formatCurrency(entry.value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Top 5 lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Top 5 clients">
                {stats.topClients.length === 0 ? (
                  <p className="text-[13px] text-slate-400 py-6 text-center">
                    Aucun client sur cette période
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.topClients.map((c, i) => (
                      <RankedRow
                        key={c.name}
                        index={i}
                        name={c.name}
                        valueLabel={formatCurrency(c.value)}
                        pct={
                          maxClient > 0
                            ? Math.round((c.value / maxClient) * 100)
                            : 0
                        }
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Top 5 produits">
                {stats.topProducts.length === 0 ? (
                  <p className="text-[13px] text-slate-400 py-6 text-center">
                    Aucun article vendu sur cette période
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.topProducts.map((p, i) => (
                      <RankedRow
                        key={p.name}
                        index={i}
                        name={p.name}
                        valueLabel={`${formatNumber(p.value)} vendus`}
                        pct={
                          maxProduct > 0
                            ? Math.round((p.value / maxProduct) * 100)
                            : 0
                        }
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
