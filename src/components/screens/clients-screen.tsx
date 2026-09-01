"use client";
// Clients management — list, add, edit, delete, and per-client invoice history.
// Matches the Flutter app's settings "Clients" tab but as a full screen.

import { useState, useMemo } from "react";
import {
  useClients,
  useInvoices,
  createClient,
  saveClient,
  deleteClient,
} from "@/lib/data-hooks";
import { useNav } from "@/components/app-shell";
import {
  ScreenHeader,
  EmptyState,
  StatusBadge,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  ReceiptText,
  ArrowRight,
  Loader2,
  Mailbox,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, refId } from "@/lib/formatters";
import { invoiceTotal, invoicePayableTotal } from "@/lib/types";
import type { Client, Invoice } from "@/lib/types";
import { toast } from "sonner";

export function ClientsScreen() {
  const { clients, loading, refresh } = useClients();
  const { invoices } = useInvoices();
  const { navigate } = useNav();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  // Map clientName → invoices (history) + totals
  const clientStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number; invoices: Invoice[] }>();
    for (const inv of invoices) {
      const key = inv.clientName.toLowerCase();
      const existing = map.get(key) || { count: 0, total: 0, invoices: [] };
      existing.count++;
      existing.total += invoiceTotal(inv.items);
      existing.invoices.push(inv);
      map.set(key, existing);
    }
    return map;
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleSave = async (data: {
    name: string;
    phone?: string;
    address?: string;
  }) => {
    if (!data.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    try {
      if (editing) {
        await saveClient({ id: editing.id, ...data });
        toast.success("Client modifié");
      } else {
        await createClient(data);
        toast.success("Client ajouté");
      }
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteClient(confirmDelete.id);
      toast.success("Client supprimé");
      setConfirmDelete(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la suppression");
    }
  };

  return (
    <div>
      <ScreenHeader
        title="Clients"
        subtitle={`${clients.length} client(s) au total`}
        icon={Users}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Ajouter
          </Button>
        }
      />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, adresse…"
            className="h-11 rounded-xl pl-9 border-slate-200"
          />
        </div>

        {/* Clients grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clients.length === 0 ? "Aucun client" : "Aucun résultat"}
            description={
              clients.length === 0
                ? "Ajoutez votre premier client pour commencer"
                : "Ajustez votre recherche"
            }
            action={
              clients.length === 0 ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Ajouter un client
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((client) => {
              const stats = clientStats.get(client.name.toLowerCase()) || {
                count: 0,
                total: 0,
              };
              const initials = client.name
                .trim()
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div
                  key={client.id}
                  className="group bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                      <span className="font-bold text-[#2563EB] text-[14px]">
                        {initials}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-[15px] truncate">
                        {client.name}
                      </p>
                      {client.phone && (
                        <p className="text-[12px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </p>
                      )}
                      {client.address && (
                        <p className="text-[12px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {client.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        Factures
                      </p>
                      <p className="text-[15px] font-extrabold text-slate-900 tabular-nums">
                        {stats.count}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        Total CA
                      </p>
                      <p className="text-[15px] font-extrabold text-[#2563EB] tabular-nums truncate">
                        {formatCurrency(stats.total)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedClient(client)}
                      className="rounded-lg h-8 flex-1 text-[12px]"
                    >
                      <ReceiptText className="w-3.5 h-3.5 mr-1" /> Historique
                    </Button>
                    <button
                      onClick={() => {
                        setEditing(client);
                        setShowForm(true);
                      }}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#2563EB] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(client)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <ClientFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        client={editing}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} sera supprimé. Les factures existantes ne seront
              pas affectées (elles conservent le nom du client en texte libre).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History dialog */}
      <ClientHistoryDialog
        client={selectedClient}
        invoices={
          selectedClient
            ? clientStats.get(selectedClient.name.toLowerCase())?.invoices || []
            : []
        }
        onClose={() => setSelectedClient(null)}
        onOpenInvoice={(id) => {
          setSelectedClient(null);
          navigate("invoice-detail", { invoiceId: id });
        }}
      />
    </div>
  );
}

function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client | null;
  onSave: (data: { name: string; phone?: string; address?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset fields when dialog opens
  useMemo(() => {
    if (open) {
      setName(client?.name || "");
      setPhone(client?.phone || "");
      setAddress(client?.address || "");
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2563EB]" />
            {client ? "Modifier le client" : "Nouveau client"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-slate-700 font-medium">
              Nom *
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du client"
              className="h-11 rounded-xl"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-phone" className="text-slate-700 font-medium">
              Téléphone
            </Label>
            <Input
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 123 45 67"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-address" className="text-slate-700 font-medium">
              Adresse
            </Label>
            <Input
              id="client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Adresse du client"
              className="h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {client ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientHistoryDialog({
  client,
  invoices,
  onClose,
  onOpenInvoice,
}: {
  client: Client | null;
  invoices: Invoice[];
  onClose: () => void;
  onOpenInvoice: (id: string) => void;
}) {
  const sorted = useMemo(
    () =>
      [...invoices].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [invoices]
  );
  const total = invoices.reduce((s, inv) => s + invoicePayableTotal(inv), 0);

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-[#2563EB]" />
            Historique de {client?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Factures
            </p>
            <p className="text-xl font-extrabold text-slate-900 tabular-nums">
              {invoices.length}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Total payé
            </p>
            <p className="text-xl font-extrabold text-[#2563EB] tabular-nums truncate">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {client?.phone && (
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mb-2">
            <Phone className="w-3.5 h-3.5" /> {client.phone}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {sorted.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-[13px]">
              Aucune facture pour ce client.
            </div>
          ) : (
            sorted.map((inv) => (
              <button
                key={inv.id}
                onClick={() => onOpenInvoice(inv.id)}
                className="group w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-[#2563EB] hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <ReceiptText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[12px] text-slate-500">
                      {refId(inv.id)}
                    </span>
                    <StatusBadge status={inv.status} size="sm" />
                  </div>
                  <p className="text-[12px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(inv.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-[#2563EB] text-[14px] tabular-nums">
                    {formatCurrency(invoicePayableTotal(inv))}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {inv.items.length} art.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
