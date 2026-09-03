"use client";
// Invoice detail — reproduces invoice_detail_screen.dart:
// view, edit, duplicate, change status, delete, PDF, PNG, share.

import { useState, useEffect, useRef } from "react";
import { useNav } from "@/components/app-shell";
import {
  ScreenHeader,
  StatusBadge,
  LoadingState,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  ArrowLeft,
  Edit3,
  Copy,
  Trash2,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  Share2,
  Download,
  Loader2,
  ChevronDown,
  Printer,
  ReceiptText,
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
} from "@/lib/formatters";
import {
  invoiceTotal,
  invoicePayableTotal,
  invoiceTotalQuantity,
  itemSubtotal,
} from "@/lib/types";
import type { Invoice } from "@/lib/types";
import { saveInvoice, deleteInvoice } from "@/lib/data-hooks";
import { toast } from "sonner";
import { generateInvoicePdf } from "@/lib/pdf-generator";

export function InvoiceDetailScreen({ invoiceId }: { invoiceId?: string }) {
  const { navigate } = useNav();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generating, setGenerating] = useState<"pdf" | "png" | "jpg" | null>(null);
  const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!invoiceId) {
      navigate("invoices");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        if (res.ok) {
          setInvoice(await res.json());
        } else {
          toast.error("Facture introuvable");
          navigate("invoices");
        }
      } catch {
        toast.error("Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId, navigate]);

  const changeStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    const updated = { ...invoice, status };
    setInvoice(updated);
    try {
      await saveInvoice({
        id: invoice.id,
        clientName: invoice.clientName,
        clientId: invoice.clientId,
        status,
        notes: invoice.notes,
        items: invoice.items,
        createdBy: invoice.createdBy,
      });
      toast.success(`Statut : ${INVOICE_STATUS_META[status].label}`);
    } catch {
      toast.error("Erreur lors du changement de statut");
    }
  };

  const duplicate = async () => {
    if (!invoice) return;
    const newId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveInvoice({
        id: newId,
        clientName: invoice.clientName + " (copie)",
        clientId: invoice.clientId,
        status: "enCours",
        notes: invoice.notes,
        items: invoice.items.map((it) => ({
          id: `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        createdBy: invoice.createdBy,
      });
      toast.success("Facture dupliquée");
      navigate("invoice-detail", { invoiceId: newId });
    } catch {
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    await deleteInvoice(invoice.id);
    toast.success("Facture supprimée");
    navigate("invoices");
  };

  const handlePdf = async () => {
    if (!invoice) return;
    setGenerating("pdf");
    try {
      const blob = await generateInvoicePdf(invoice);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture_${invoice.clientName.replace(/\s+/g, "_")}_${refId(invoice.id).slice(1)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF généré");
    } catch (e: any) {
      toast.error("Erreur génération PDF: " + e.message);
    } finally {
      setGenerating(null);
    }
  };

  const handlePng = async () => {
    if (!invoice || !invoiceRef.current) return;
    setGenerating("png");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `facture_${invoice.clientName.replace(/\s+/g, "_")}_${refId(invoice.id).slice(1)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
      toast.success("Image PNG générée");
    } catch (e: any) {
      toast.error("Erreur génération PNG: " + e.message);
    } finally {
      setGenerating(null);
    }
  };

  const generateImageBlob = async (type: "image/png" | "image/jpeg") => {
    if (!invoiceRef.current) throw new Error("Facture non disponible");
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion image échouée"))), type, type === "image/jpeg" ? 0.92 : undefined);
    });
  };

  const handleJpg = async () => {
    if (!invoice) return;
    setGenerating("jpg");
    try {
      const blob = await generateImageBlob("image/jpeg");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture_${invoice.clientName.replace(/\s+/g, "_")}_${refId(invoice.id).slice(1)}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Image JPG générée");
    } catch (e: any) {
      toast.error("Erreur génération JPG: " + e.message);
    } finally {
      setGenerating(null);
    }
  };

  const handleShare = () => {
    setShareChoiceOpen(true);
  };

  const shareAs = async (format: "pdf" | "jpg") => {
    if (!invoice) return;
    setShareChoiceOpen(false);
    setGenerating(format === "pdf" ? "pdf" : "jpg");
    try {
      const blob = format === "pdf"
        ? await generateInvoicePdf(invoice)
        : await generateImageBlob("image/jpeg");
      const file = new File(
        [blob],
        `facture_${invoice.clientName.replace(/\s+/g, "_")}.${format}`,
        { type: format === "pdf" ? "application/pdf" : "image/jpeg" }
      );
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Facture – ${invoice.clientName}`,
          text: `Facture ${refId(invoice.id)} – ${formatCurrency(invoicePayableTotal(invoice))}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Fichier téléchargé");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Partage échoué");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <LoadingState message="Chargement de la facture…" />;
  if (!invoice) return null;

  const total = invoiceTotal(invoice.items);
  const payable = invoicePayableTotal(invoice);
  const qty = invoiceTotalQuantity(invoice.items);

  return (
    <div>
      <ScreenHeader
        title={invoice.clientName}
        subtitle={`${refId(invoice.id)} · ${formatDateTime(invoice.createdAt)}`}
        icon={ReceiptText}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("invoices")}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("new-invoice", { invoiceId: invoice.id })}
              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <Edit3 className="w-4 h-4 mr-1.5" /> Modifier
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-9 w-9 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={duplicate}>
                  <Copy className="w-4 h-4 mr-2" /> Dupliquer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePdf} disabled={generating !== null}>
                  <FileText className="w-4 h-4 mr-2" /> Télécharger PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePng} disabled={generating !== null}>
                  <ImageIcon className="w-4 h-4 mr-2" /> Télécharger PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleJpg} disabled={generating !== null}>
                  <ImageIcon className="w-4 h-4 mr-2" /> Télécharger JPG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare} disabled={generating !== null}>
                  <Share2 className="w-4 h-4 mr-2" /> Partager
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        {/* Status changer */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-slate-400">Statut :</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5">
                <StatusBadge status={invoice.status} />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {INVOICE_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: INVOICE_STATUS_META[s].color }}
                  />
                  {INVOICE_STATUS_META[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handlePdf}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-all disabled:opacity-50"
          >
            {generating === "pdf" ? (
              <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-[#2563EB]" />
            )}
            <span className="text-[11px] font-medium text-slate-600">PDF</span>
          </button>
          <button
            onClick={handleJpg}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-all disabled:opacity-50"
          >
            {generating === "jpg" ? <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" /> : <ImageIcon className="w-5 h-5 text-[#2563EB]" />}
            <span className="text-[11px] font-medium text-slate-600">Image JPG</span>
          </button>
          <button
            onClick={handlePng}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-all disabled:opacity-50"
          >
            {generating === "png" ? (
              <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5 text-[#2563EB]" />
            )}
            <span className="text-[11px] font-medium text-slate-600">Image PNG</span>
          </button>
          <button
            onClick={handleShare}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-all disabled:opacity-50"
          >
            <Share2 className="w-5 h-5 text-[#2563EB]" />
            <span className="text-[11px] font-medium text-slate-600">Partager</span>
          </button>
        </div>

        {/* Printable invoice (also used for PNG capture) */}
        <div ref={invoiceRef} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
          <InvoicePrintable invoice={invoice} />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture de {invoice.clientName} sera
              définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={shareChoiceOpen} onOpenChange={setShareChoiceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choisir le format de partage</AlertDialogTitle>
            <AlertDialogDescription>Choisissez le fichier à envoyer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => shareAs("pdf")}>Partager en PDF</AlertDialogAction>
            <AlertDialogAction onClick={() => shareAs("jpg")} className="bg-slate-700 hover:bg-slate-800">Partager en image (JPG)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// The printable invoice layout, matching pdf_service.dart structure.
// Used both for on-screen display and html2canvas PNG capture.
export function InvoicePrintable({ invoice }: { invoice: Invoice }) {
  const total = invoiceTotal(invoice.items);
  const payable = invoicePayableTotal(invoice);
  const qty = invoiceTotalQuantity(invoice.items);

  const initials = invoice.clientName
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="text-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1
            className="text-3xl font-bold tracking-wider"
            style={{ color: "#1D4ED8" }}
          >
            FACTURE
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">RÉF:</span>
            <span className="text-[12px] font-bold" style={{ color: "#2563EB" }}>
              {refId(invoice.id)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#2563EB" }} />
            <span className="text-[10px] text-slate-400">{formatDateTime(invoice.createdAt)}</span>
          </div>
        </div>
        <div
          className="px-3.5 py-2 rounded-full text-white text-[11px] font-bold tracking-wider"
          style={{ backgroundColor: INVOICE_STATUS_META[invoice.status].color }}
        >
          {INVOICE_STATUS_META[invoice.status].label}
        </div>
      </div>

      {/* Divider */}
      <div className="h-[3px] w-14 rounded" style={{ backgroundColor: "#2563EB" }} />

      {/* Client box */}
      <div
        className="mt-5 rounded-xl p-4 flex items-center gap-3.5"
        style={{ backgroundColor: "#F1F5FE", border: "1px solid #E0E9F8" }}
      >
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: "#2563EB" }}>{initials}</span>
        </div>
        <div>
          <p className="text-[8px] font-bold text-slate-400 tracking-widest">CLIENT</p>
          <p className="text-base font-bold text-slate-800">{invoice.clientName}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="mt-6">
        <div
          className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-t-lg text-white text-[9px] font-bold tracking-wider"
          style={{ backgroundColor: "#2563EB" }}
        >
          <div className="col-span-6">ARTICLE</div>
          <div className="col-span-2 text-center">QTÉ</div>
          <div className="col-span-2 text-right">PRIX UNIT.</div>
          <div className="col-span-2 text-right">SOUS-TOTAL</div>
        </div>
        {invoice.items.map((it, i) => (
          <div
            key={it.id}
            className="grid grid-cols-12 gap-2 px-3 py-2.5 text-[11px] border-b"
            style={{
              backgroundColor: i % 2 === 0 ? "#fff" : "#F9FBFE",
              borderColor: "#EFF3F8",
            }}
          >
            <div className="col-span-6 font-medium text-slate-800">{it.name}</div>
            <div className="col-span-2 text-center text-slate-600">{it.quantity}</div>
            <div className="col-span-2 text-right text-slate-600">{formatCurrency(it.unitPrice)}</div>
            <div className="col-span-2 text-right font-bold" style={{ color: "#2563EB" }}>
              {formatCurrency(itemSubtotal(it))}
            </div>
          </div>
        ))}
      </div>

      {/* Total box */}
      <div className="mt-5 flex justify-end">
        <div
          className="w-full max-w-[280px] rounded-xl p-5 text-white"
          style={{
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
          }}
        >
          <p className="text-[9px] font-bold tracking-widest text-white/70">TOTAL</p>
          <p className="text-2xl font-extrabold mt-1">{formatCurrency(total)}</p>
          <div className="h-px bg-white/20 my-2.5" />
          <div className="flex justify-between text-[10px]">
            <span className="text-white/70">Articles</span>
            <span className="font-bold">{invoice.items.length}</span>
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-white/70">Unités totales</span>
            <span className="font-bold">{qty}</span>
          </div>
          <div className="h-px bg-white/20 my-2.5" />
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-bold text-white/70 tracking-wider">À PAYER</span>
            <span className="text-lg font-extrabold">{formatCurrency(payable)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div
          className="mt-4 rounded-lg p-3.5"
          style={{ backgroundColor: "#FFFBEF", border: "1px solid #FCEFC0" }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#D9A519" }} />
            <span className="text-[10px] font-bold text-slate-800">Notes</span>
          </div>
          <p className="text-[11px] text-slate-500 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-slate-100 text-center">
        <p className="text-[9px] font-bold" style={{ color: "#2563EB" }}>
          Facturier Konté Bussness Services
        </p>
        <p className="text-[8px] text-slate-400 mt-0.5">Solution conçue par Mohamed</p>
      </div>
    </div>
  );
}
