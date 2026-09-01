"use client";
// Invoices list — reproduces history_screen.dart:
// search, status filters, sort, multi-select, CSV export, bulk delete.

import { useState, useMemo, useCallback } from "react";
import { useInvoices, deleteInvoice, saveInvoice } from "@/lib/data-hooks";
import { useNav } from "@/components/app-shell";
import {
  ScreenHeader,
  StatusBadge,
  EmptyState,
  InvoiceCardSkeleton,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  Trash2,
  CheckSquare,
  X,
  ReceiptText,
  RefreshCw,
  ArrowUpDown,
  Filter,
  Calendar,
  CalendarDays,
  XCircle,
  Repeat,
} from "lucide-react";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/constants";
import {
  formatCurrency,
  formatDateTime,
  refId,
  escapeCsv,
  numStr,
} from "@/lib/formatters";
import {
  invoiceTotal,
  invoicePayableTotal,
  invoiceTotalQuantity,
} from "@/lib/types";
import type { Invoice } from "@/lib/types";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SortOption =
  | "dateDesc"
  | "dateAsc"
  | "totalDesc"
  | "totalAsc"
  | "clientAsc";

const SORT_LABELS: Record<SortOption, string> = {
  dateDesc: "Plus récentes",
  dateAsc: "Plus anciennes",
  totalDesc: "Montant décroissant",
  totalAsc: "Montant croissant",
  clientAsc: "Client A→Z",
};

export function InvoicesScreen() {
  const { invoices, loading, refresh } = useInvoices();
  const { navigate } = useNav();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Set<InvoiceStatus>>(new Set());
  const [sort, setSort] = useState<SortOption>("dateDesc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const toggleFilter = (s: InvoiceStatus) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.clientName.toLowerCase().includes(q) ||
          inv.id.toLowerCase().includes(q) ||
          inv.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }
    if (filters.size > 0) {
      list = list.filter((inv) => filters.has(inv.status));
    }
    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((inv) => new Date(inv.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((inv) => new Date(inv.createdAt) <= to);
    }
    list.sort((a, b) => {
      switch (sort) {
        case "dateDesc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "dateAsc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "totalDesc":
          return invoiceTotal(b.items) - invoiceTotal(a.items);
        case "totalAsc":
          return invoiceTotal(a.items) - invoiceTotal(b.items);
        case "clientAsc":
          return a.clientName.localeCompare(b.clientName);
      }
    });
    return list;
  }, [invoices, search, filters, sort, dateFrom, dateTo]);

  // Summary stats for the current filter
  const summary = useMemo(() => {
    const count = filtered.length;
    const totalPayable = filtered.reduce((s, inv) => s + invoicePayableTotal(inv), 0);
    const totalQty = filtered.reduce((s, inv) => s + invoiceTotalQuantity(inv.items), 0);
    return { count, totalPayable, totalQty };
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((i) => i.id)));
  const clearSelection = () => setSelected(new Set());

  const exportCsv = useCallback(() => {
    const toExport = selected.size > 0 ? filtered.filter((i) => selected.has(i.id)) : filtered;
    if (toExport.length === 0) {
      toast.error("Aucune facture à exporter");
      return;
    }
    const rows: string[][] = [
      ["Date", "Réf", "Client", "Statut", "Article", "Quantité", "Prix unitaire", "Sous-total", "Total facture", "Notes"],
    ];
    for (const inv of toExport) {
      const date = formatDateTime(inv.createdAt);
      const ref = refId(inv.id);
      const total = numStr(invoiceTotal(inv.items));
      const notes = inv.notes ?? "";
      for (const item of inv.items) {
        rows.push([
          date,
          ref,
          inv.clientName,
          INVOICE_STATUS_META[inv.status].label,
          item.name,
          String(item.quantity),
          numStr(item.unitPrice),
          numStr(item.quantity * item.unitPrice),
          total,
          notes,
        ]);
      }
    }
    const csv = "\uFEFF" + rows.map((r) => r.map(escapeCsv).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${toExport.length} facture(s) exportée(s) en CSV`);
    setSelectionMode(false);
    clearSelection();
  }, [filtered, selected]);

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await deleteInvoice(id);
    }
    toast.success(`${ids.length} facture(s) supprimée(s)`);
    setConfirmDelete(false);
    setSelectionMode(false);
    clearSelection();
    refresh();
  };

  const bulkChangeStatus = async (status: InvoiceStatus) => {
    const ids = Array.from(selected);
    const selectedInvoices = invoices.filter((inv) => ids.includes(inv.id));
    for (const inv of selectedInvoices) {
      await saveInvoice({
        id: inv.id,
        clientName: inv.clientName,
        clientId: inv.clientId,
        status,
        notes: inv.notes,
        discount: inv.discount,
        taxRate: inv.taxRate,
        items: inv.items,
        createdBy: inv.createdBy,
      });
    }
    toast.success(
      `${ids.length} facture(s) → ${INVOICE_STATUS_META[status].label}`
    );
    setBulkStatusOpen(false);
    setSelectionMode(false);
    clearSelection();
    refresh();
  };

  return (
    <div>
      <ScreenHeader
        title="Factures"
        subtitle={`${invoices.length} facture(s) au total`}
        icon={ReceiptText}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="rounded-xl h-9 px-3"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("new-invoice")}
              className="rounded-xl h-9 bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" /> Nouvelle
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Search + actions bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par client, article, réf…"
              className="h-10 rounded-xl pl-9 border-slate-200"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl h-10 px-3">
                <ArrowUpDown className="w-4 h-4 mr-1.5" /> {SORT_LABELS[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setSort(s)}>
                  {SORT_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectionMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                className="rounded-xl h-10 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Exporter ({selected.size})
              </Button>
              <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.size === 0}
                    className="rounded-xl h-10 bg-blue-50 text-[#2563EB] border-blue-200 hover:bg-blue-100"
                  >
                    <Repeat className="w-4 h-4 mr-1.5" /> Statut ({selected.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <p className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Changer le statut
                  </p>
                  {INVOICE_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => bulkChangeStatus(s)}
                    >
                      <span
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: INVOICE_STATUS_META[s].color }}
                      />
                      {INVOICE_STATUS_META[s].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={selected.size === 0}
                className="rounded-xl h-10 bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Supprimer ({selected.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectionMode(false);
                  clearSelection();
                }}
                className="rounded-xl h-10"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="rounded-xl h-10 px-3"
            >
              <CheckSquare className="w-4 h-4 mr-1.5" /> Sélectionner
            </Button>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtres :
          </span>
          {INVOICE_STATUSES.map((s) => {
            const meta = INVOICE_STATUS_META[s];
            const active = filters.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleFilter(s)}
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  active
                    ? "text-white border-transparent"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
                style={active ? { backgroundColor: meta.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: active ? "white" : meta.color }}
                />
                {meta.label}
              </button>
            );
          })}
          {filters.size > 0 && (
            <button
              onClick={() => setFilters(new Set())}
              className="text-[12px] font-medium text-slate-400 hover:text-slate-600 underline"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> Période :
          </span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border-slate-200 text-[12.5px] w-[140px]"
              aria-label="Date de début"
            />
            <span className="text-slate-300 text-[12px]">→</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border-slate-200 text-[12.5px] w-[140px]"
              aria-label="Date de fin"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-400 hover:text-red-500"
            >
              <XCircle className="w-3.5 h-3.5" /> Effacer
            </button>
          )}
        </div>

        {selectionMode && selected.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <span className="text-[12px] font-medium text-blue-700">
              {selected.size} sélectionnée(s)
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[12px] font-medium text-blue-600 hover:underline"
              >
                Tout sélectionner
              </button>
              <button
                onClick={clearSelection}
                className="text-[12px] font-medium text-slate-500 hover:underline"
              >
                Désélectionner
              </button>
            </div>
          </div>
        )}

        {/* Summary stats for the active filter */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Factures
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums leading-none">
                {summary.count}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Total
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-[#2563EB] tabular-nums leading-none">
                {formatCurrency(summary.totalPayable)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Articles
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums leading-none">
                {summary.totalQty}
              </p>
            </div>
          </div>
        )}

        {/* Invoices list */}
        {loading ? (
          <InvoiceCardSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={invoices.length === 0 ? "Aucune facture" : "Aucun résultat"}
            description={
              invoices.length === 0
                ? "Créez votre première facture pour commencer"
                : "Ajustez votre recherche ou vos filtres"
            }
            action={
              invoices.length === 0 ? (
                <Button
                  onClick={() => navigate("new-invoice")}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Nouvelle facture
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                selectionMode={selectionMode}
                selected={selected.has(inv.id)}
                onToggleSelect={() => toggleSelect(inv.id)}
                onOpen={() => navigate("invoice-detail", { invoiceId: inv.id })}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selected.size} facture(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les factures sélectionnées seront
              définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={bulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InvoiceCard({
  invoice,
  selectionMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  invoice: Invoice;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const total = invoiceTotal(invoice.items);
  const payable = invoicePayableTotal(invoice);
  const qty = invoiceTotalQuantity(invoice.items);
  return (
    <div
      className={`group bg-white rounded-2xl border transition-all duration-200 ${
        selected
          ? "border-[#2563EB] ring-2 ring-[#2563EB]/20"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-stretch">
        {selectionMode && (
          <div className="flex items-center pl-3">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
          </div>
        )}
        <button
          onClick={selectionMode ? onToggleSelect : onOpen}
          className="flex-1 flex items-center gap-3 p-3.5 sm:p-4 text-left min-w-0"
        >
          {/* Left: status accent bar */}
          <div
            className="w-1 h-12 rounded-full shrink-0 transition-all group-hover:h-14"
            style={{ backgroundColor: INVOICE_STATUS_META[invoice.status].color }}
          />
          {/* Middle: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-slate-900 text-[15px] truncate">
                {invoice.clientName}
              </p>
              <StatusBadge status={invoice.status} size="sm" />
            </div>
            <div className="flex items-center gap-3 text-[12px] text-slate-400">
              <span className="font-mono">{refId(invoice.id)}</span>
              <span>·</span>
              <span>{formatDateTime(invoice.createdAt)}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {invoice.items.length} article{invoice.items.length > 1 ? "s" : ""} · {qty} unité{qty > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {/* Right: total */}
          <div className="text-right shrink-0">
            <p className="font-extrabold text-[#2563EB] text-[16px] leading-tight tabular-nums">
              {formatCurrency(payable)}
            </p>
            {(invoice.discount > 0 || invoice.taxRate > 0) ? (
              <p className="text-[11px] text-slate-400 tabular-nums">
                {formatCurrency(total)}
              </p>
            ) : (
              <p className="text-[10px] text-slate-300">
                {invoice.items.length} art. · {qty}u
              </p>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
