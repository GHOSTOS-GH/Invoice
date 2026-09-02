"use client";
// New / edit invoice with client suggestions, item entry and live totals.

import { useState, useMemo, useEffect, useRef } from "react";
import { useClients, useProducts, saveInvoice, createClient } from "@/lib/data-hooks";
import { useNav } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { ScreenHeader } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusCircle,
  Trash2,
  Save,
  ArrowLeft,
  Package,
  User,
  X,
  Search,
  Loader2,
  StickyNote,
} from "lucide-react";
import {
  formatCurrency,
  formatNumber,
} from "@/lib/formatters";
import {
  invoiceTotal,
  invoicePayableTotal,
  itemSubtotal,
  invoiceTotalQuantity,
} from "@/lib/types";
import { INVOICE_STATUS_META, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/constants";
import type { InvoiceItem, Invoice } from "@/lib/types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

let _itemCounter = 0;
function genItemId() {
  _itemCounter++;
  return `item_${Date.now().toString(36)}_${_itemCounter}`;
}

function genInvoiceId() {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function NewInvoiceScreen({ editInvoiceId }: { editInvoiceId?: string }) {
  const { clients } = useClients();
  const { products } = useProducts();
  const { navigate } = useNav();
  const { user } = useAuth();

  const [invoiceId] = useState(() => editInvoiceId || genInvoiceId());
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("enCours");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editInvoiceId);

  // Item form
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // Client suggestions
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Load existing invoice for edit
  useEffect(() => {
    if (!editInvoiceId) return;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${editInvoiceId}`);
        if (res.ok) {
          const inv: Invoice = await res.json();
          setClientName(inv.clientName);
          setStatus(inv.status);
          setNotes(inv.notes ?? "");
          setItems(inv.items.map((it) => ({ ...it })));
        }
      } catch {
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editInvoiceId]);

  const clientSuggestions = useMemo(() => {
    if (!clientName.trim()) return [];
    const q = clientName.toLowerCase();
    return clients
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => c.name);
  }, [clientName, clients]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const productCategories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["Tous", ...Array.from(set)];
  }, [products]);

  const [activeCategory, setActiveCategory] = useState("Tous");

  const categoryProducts = useMemo(() => {
    if (activeCategory === "Tous") return filteredProducts;
    return filteredProducts.filter((p) => p.category === activeCategory);
  }, [filteredProducts, activeCategory]);

  const total = invoiceTotal(items);
  const payable = invoicePayableTotal({ items });
  const totalQty = invoiceTotalQuantity(items);

  const addItem = () => {
    const name = itemName.trim();
    const qty = Number(itemQty) || 0;
    const price = Number(itemPrice) || 0;
    if (!name || qty <= 0 || price < 0) {
      toast.error("Veuillez remplir nom, quantité et prix");
      return;
    }
    setItems((prev) => [
      ...prev,
      { id: genItemId(), name, quantity: qty, unitPrice: price },
    ]);
    setItemName("");
    setItemQty("1");
    setItemPrice("");
    // Focus back on name input
    setTimeout(() => {
      const el = document.getElementById("item-name-input") as HTMLInputElement;
      el?.focus();
    }, 50);
  };

  const addProductFromPicker = (productName: string) => {
    setItemName(productName);
    setShowProductPicker(false);
    setProductSearch("");
    setTimeout(() => {
      const el = document.getElementById("item-qty-input") as HTMLInputElement;
      el?.focus();
    }, 50);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleSave = async () => {
    if (!clientName.trim()) {
      toast.error("Veuillez saisir le nom du client");
      return;
    }
    if (items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }
    setSaving(true);
    try {
      // Auto-create client if not exists
      const existingClient = clients.find(
        (c) => c.name.toLowerCase() === clientName.trim().toLowerCase()
      );
      let clientId = existingClient?.id;
      if (!clientId) {
        try {
          const created = await createClient({ name: clientName.trim() });
          clientId = created.id;
        } catch {}
      }

      await saveInvoice({
        id: invoiceId,
        clientName: clientName.trim(),
        clientId,
        status,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        createdBy: user!.id,
      });
      toast.success(editInvoiceId ? "Facture modifiée" : "Facture créée");
      navigate("invoices");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader
        title={editInvoiceId ? "Modifier la facture" : "Nouvelle facture"}
        subtitle={`${items.length} article(s) · ${formatCurrency(payable)}`}
        icon={PlusCircle}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("invoices")}
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
        }
      />

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        {/* Client + status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="relative">
            <Label className="text-slate-700 font-medium mb-1.5 block">
              <User className="w-3.5 h-3.5 inline mr-1" /> Client *
            </Label>
            <Input
              ref={clientInputRef}
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
              placeholder="Nom du client"
              className="h-11 rounded-xl"
            />
            {showClientSuggestions && clientSuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {clientSuggestions.map((name) => (
                  <button
                    key={name}
                    onMouseDown={() => {
                      setClientName(name);
                      setShowClientSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-slate-700 font-medium mb-1.5 block">Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: INVOICE_STATUS_META[s].color }}
                      />
                      {INVOICE_STATUS_META[s].label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-[15px]">
              Articles ({items.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProductPicker(true)}
              className="rounded-xl h-10 border-[#2563EB] text-[#2563EB] font-bold"
            >
              <Package className="w-5 h-5 mr-1.5" /> Choisir un produit
            </Button>
          </div>

          {/* Item entry form */}
          <div className="grid grid-cols-12 gap-2 mb-3">
            <div className="col-span-12 text-[11px] font-semibold text-slate-500 sm:hidden">Nom · Quantité · Prix unitaire</div>
            <div className="col-span-12 sm:col-span-5">
              <Input
                id="item-name-input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("item-qty-input")?.focus();
                  }
                }}
                placeholder="Nom de l'article"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input
                id="item-qty-input"
                type="number"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("item-price-input")?.focus();
                  }
                }}
                placeholder="Qté"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="col-span-5 sm:col-span-3">
              <Input
                id="item-price-input"
                type="number"
                min="0"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Prix unit. FCFA"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <Button
                onClick={addItem}
                className="w-full h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </div>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-[13px]">
              Aucun article. Ajoutez-en un ci-dessus ou choisissez depuis la bibliothèque.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <span className="sr-only">Nom de l'article</span>
                    <Input
                      value={it.name}
                      onChange={(e) => updateItem(it.id, "name", e.target.value)}
                      className="h-8 rounded-lg border-transparent bg-white text-[13px] font-medium"
                    />
                  </div>
                  <div className="w-14 shrink-0">
                    <span className="sr-only">Quantité</span>
                    <Input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.id, "quantity", Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-8 w-14 rounded-lg border-transparent bg-white text-[13px] text-center"
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <span className="sr-only">Prix unitaire</span>
                    <Input
                    type="number"
                    min="0"
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(it.id, "unitPrice", Math.max(0, Number(e.target.value) || 0))
                    }
                    className="h-8 w-24 rounded-lg border-transparent bg-white text-[13px] text-right"
                    />
                  </div>
                  <div className="w-28 text-right text-[13px] font-bold text-[#2563EB] shrink-0">
                    <span className="sr-only">Sous-total : </span>
                    {formatCurrency(itemSubtotal(it))}
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h3 className="font-bold text-slate-900 text-[15px] flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-[#2563EB]" /> Notes
          </h3>
          <div>
            <Label className="text-slate-600 text-[12px] mb-1 block">Notes optionnelles</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes optionnelles…"
              className="rounded-xl min-h-[70px] resize-none"
            />
          </div>
        </div>

        {/* Totals — simple sum, no discount/tax */}
        <div className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] rounded-2xl p-5 text-white shadow-lg shadow-blue-500/25">
          <div className="flex justify-between text-[13px] mb-3">
            <span className="text-white/70">Sous-total ({totalQty} unités)</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
          <div className="border-t border-white/20 pt-3 flex justify-between items-end">
            <span className="text-white/70 text-[12px] font-bold tracking-wider">TOTAL À PAYER</span>
            <span className="text-2xl font-extrabold">{formatCurrency(payable)}</span>
          </div>
        </div>

        {/* Save */}
        <div className="sticky bottom-0 z-10 flex gap-3 pb-4 pt-3 bg-slate-50/95 backdrop-blur-sm">
          <Button
            variant="outline"
            onClick={() => navigate("invoices")}
            className="rounded-xl h-12 flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl h-12 flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-base font-bold"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {editInvoiceId ? "Enregistrer" : "Créer la facture"}
          </Button>
        </div>
      </div>

      {/* Product picker dialog */}
      <ProductPickerDialog
        open={showProductPicker}
        onOpenChange={setShowProductPicker}
        categories={productCategories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        products={categoryProducts}
        search={productSearch}
        setSearch={setProductSearch}
        onPick={addProductFromPicker}
      />
    </div>
  );
}

function ProductPickerDialog({
  open,
  onOpenChange,
  categories,
  activeCategory,
  setActiveCategory,
  products,
  search,
  setSearch,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: string[];
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  products: any[];
  search: string;
  setSearch: (s: string) => void;
  onPick: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#2563EB]" /> Choisir un produit
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeCategory === cat
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {products.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-400 text-[13px]">
              Aucun produit. Ajoutez-en dans Réglages → Produits.
            </div>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.name)}
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-all"
              >
                <div className="w-full aspect-square rounded-lg bg-slate-100 mb-2 overflow-hidden flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <p className="font-medium text-[13px] text-slate-900 truncate">{p.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{p.category}</p>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
