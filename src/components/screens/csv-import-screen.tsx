"use client";
// CSV Import screen — drop zone, PapaParse parsing, column mapping,
// replace/merge choice, validation summary, progress + import via saveInvoice.

import { useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  saveInvoice,
  deleteInvoice,
  useInvoices,
} from "@/lib/data-hooks";
import { useNav } from "@/components/app-shell";
import {
  ScreenHeader,
  SectionCard,
  EmptyState,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileUp,
  X,
  Database,
  Plus,
  RefreshCw,
} from "lucide-react";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceItem } from "@/lib/types";

// ---------- Field definitions ----------

type ImportField =
  | "client_name"
  | "item_name"
  | "quantity"
  | "unit_price"
  | "status"
  | "notes"
  | "created_at"
  | "ref";

interface FieldDef {
  key: ImportField;
  label: string;
  required: boolean;
  description: string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: "client_name", label: "Client", required: true, description: "Nom du client" },
  { key: "item_name", label: "Article", required: true, description: "Nom de l'article" },
  { key: "quantity", label: "Quantité", required: true, description: "Quantité (nombre)" },
  { key: "unit_price", label: "Prix unitaire", required: true, description: "Prix unitaire (FCFA)" },
  { key: "status", label: "Statut", required: false, description: "enCours / livree / …" },
  { key: "notes", label: "Notes", required: false, description: "Notes de la facture" },
  { key: "created_at", label: "Date", required: false, description: "Date de création" },
  { key: "ref", label: "Référence", required: false, description: "Regroupe les lignes d'une même facture" },
];

// Helpers to coerce CSV string values into typed values

function parseNumber(raw: string | undefined, fallback = 0): number {
  if (!raw) return fallback;
  // Accept "1 250,50" or "1,250.50" or "1250.5"
  let s = String(raw).trim();
  if (!s) return fallback;
  // Remove spaces and thousands separators
  s = s.replace(/\s/g, "");
  // French style: 1250,50 → 1250.50
  if (s.indexOf(",") !== -1 && s.indexOf(".") === -1) {
    s = s.replace(",", ".");
  } else if (s.indexOf(",") !== -1 && s.indexOf(".") !== -1) {
    // Both present: assume , is thousands
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function parseStatus(raw: string | undefined): InvoiceStatus {
  if (!raw) return "enCours";
  const v = String(raw).trim().toLowerCase();
  if (v === "encours" || v === "en cours" || v === "en_cours") return "enCours";
  if (v === "enlivraison" || v === "en livraison" || v === "en_livraison") return "enLivraison";
  if (v === "livree" || v === "livrée" || v === "livre") return "livree";
  if (v === "archivee" || v === "archivée" || v === "archive") return "archivee";
  // English fallbacks
  if (v === "pending" || v === "draft") return "enCours";
  if (v === "delivered" || v === "paid") return "livree";
  if (v === "archived") return "archivee";
  return "enCours";
}

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const v = String(raw).trim();
  if (!v) return new Date().toISOString();
  // dd/MM/yyyy or dd/MM/yyyy à HH:mm
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyy, hh, mi] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      hh ? Number(hh) : 0,
      mi ? Number(mi) : 0
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

// ---------- Component ----------

interface ParsedRow {
  [key: string]: string;
}

interface InvoiceGroup {
  ref: string;
  clientName: string;
  status: InvoiceStatus;
  notes: string;
  createdAt: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

let _importItemCounter = 0;
function genItemId() {
  _importItemCounter++;
  return `item_csv_${Date.now().toString(36)}_${_importItemCounter}`;
}

function genInvoiceId() {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CsvImportScreen() {
  const { navigate } = useNav();
  const { invoices: existingInvoices, refresh } = useInvoices();

  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>(
    {}
  );
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect column mapping when a new file is parsed
  const autoDetectMapping = useCallback((cols: string[]) => {
    const lower = cols.map((c) => ({
      raw: c,
      norm: c
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim(),
    }));
    const find = (patterns: string[]): string | undefined => {
      for (const p of patterns) {
        const hit = lower.find((c) => c.norm === p);
        if (hit) return hit.raw;
      }
      for (const p of patterns) {
        const hit = lower.find((c) => c.norm.includes(p));
        if (hit) return hit.raw;
      }
      return undefined;
    };
    const next: Partial<Record<ImportField, string>> = {
      client_name: find(["client", "nom"]),
      item_name: find(["article", "produit", "designation", "libelle", "description"]),
      quantity: find(["quantite", "qte", "qty"]),
      unit_price: find(["prix unitaire", "prix", "pu", "unit price", "price"]),
      status: find(["statut", "status", "etat"]),
      notes: find(["note", "notes", "observation"]),
      created_at: find(["date", "cree le", "created"]),
      ref: find(["ref", "reference", "n facture", "facture", "numero"]),
    };
    setMapping(next);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        toast.error("Veuillez sélectionner un fichier .csv");
        return;
      }
      setParsing(true);
      setParseError(null);
      setFileName(file.name);
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          setParsing(false);
          if (results.errors.length > 0) {
            const first = results.errors[0];
            setParseError(
              `Ligne ${first.row ?? "?"}: ${first.message || "erreur de parsing"}`
            );
          }
          const cols = results.meta.fields?.filter((f) => f) || [];
          const data = (results.data || []).filter(
            (r) => Object.values(r).some((v) => v && String(v).trim())
          );
          if (cols.length === 0) {
            setParseError("Aucune colonne détectée. Vérifiez l'en-tête du fichier.");
            setColumns([]);
            setRows([]);
            return;
          }
          if (data.length === 0) {
            setParseError("Aucune ligne de donnée trouvée dans le fichier.");
          }
          setColumns(cols);
          setRows(data);
          autoDetectMapping(cols);
          toast.success(
            `${data.length} ligne(s) · ${cols.length} colonne(s) détectée(s)`
          );
        },
        error: (err: any) => {
          setParsing(false);
          setParseError(err?.message || "Échec du parsing CSV");
        },
      });
    },
    [autoDetectMapping]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleBrowseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetFile = () => {
    setFileName(null);
    setColumns([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setProgress(0);
    setProgressLabel("");
  };

  // ---------- Build invoice groups from rows + mapping ----------

  const groups: InvoiceGroup[] = useMemo(() => {
    if (rows.length === 0) return [];
    const requiredFields: ImportField[] = ["client_name", "item_name"];
    for (const f of requiredFields) {
      if (!mapping[f]) return [];
    }
    const refCol = mapping.ref;
    const clientCol = mapping.client_name!;
    const itemCol = mapping.item_name!;
    const qtyCol = mapping.quantity;
    const priceCol = mapping.unit_price;
    const statusCol = mapping.status;
    const notesCol = mapping.notes;
    const dateCol = mapping.created_at;

    const groupMap = new Map<string, InvoiceGroup>();
    let i = 0;
    for (const row of rows) {
      const clientName = (clientCol ? row[clientCol] : "").trim();
      const itemName = (itemCol ? row[itemCol] : "").trim();
      if (!clientName && !itemName) continue;
      // Group key: ref if mapped else client+date fallback to per-row unique
      const ref = refCol && row[refCol]?.trim()
        ? row[refCol].trim()
        : `auto_${i}_${clientName}`;
      const createdAt = dateCol ? parseDate(row[dateCol]) : new Date().toISOString();
      if (!groupMap.has(ref)) {
        groupMap.set(ref, {
          ref,
          clientName: clientName || "Client inconnu",
          status: statusCol ? parseStatus(row[statusCol]) : "enCours",
          notes: notesCol ? (row[notesCol] || "").trim() : "",
          createdAt,
          items: [],
        });
      }
      const g = groupMap.get(ref)!;
      g.items.push({
        name: itemName || "Article",
        quantity: qtyCol ? Math.max(1, Math.round(parseNumber(row[qtyCol], 1))) : 1,
        unitPrice: priceCol ? parseNumber(row[priceCol], 0) : 0,
      });
      i++;
    }
    return Array.from(groupMap.values());
  }, [rows, mapping]);

  const totalItems = useMemo(
    () => groups.reduce((s, g) => s + g.items.length, 0),
    [groups]
  );

  const missingRequired = FIELD_DEFS.filter(
    (f) => f.required && !mapping[f.key]
  );

  const canImport =
    !importing &&
    groups.length > 0 &&
    missingRequired.length === 0;

  // ---------- Import ----------

  const handleImport = async () => {
    if (!canImport) {
      if (missingRequired.length > 0) {
        toast.error(
          `Champs obligatoires manquants : ${missingRequired
            .map((f) => f.label)
            .join(", ")}`
        );
      }
      return;
    }

    // Confirm destructive replace mode
    if (mode === "replace" && existingInvoices.length > 0) {
      const ok = window.confirm(
        `Remplacer toutes les données ? Cela supprimera ${existingInvoices.length} facture(s) existante(s) avant l'import.`
      );
      if (!ok) return;
    }

    setImporting(true);
    setProgress(0);
    setProgressLabel("Initialisation…");

    try {
      const total =
        (mode === "replace" ? existingInvoices.length : 0) + groups.length;
      let done = 0;

      if (mode === "replace") {
        setProgressLabel("Suppression des factures existantes…");
        for (const inv of existingInvoices) {
          try {
            await deleteInvoice(inv.id);
          } catch {}
          done++;
          setProgress(Math.round((done / total) * 100));
        }
      }

      let imported = 0;
      let idx = 0;
      for (const g of groups) {
        idx++;
        setProgressLabel(
          `Création facture ${idx}/${groups.length} — ${g.clientName}`
        );
        const items: InvoiceItem[] = g.items.map((it) => ({
          id: genItemId(),
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }));
        const invoice: Partial<Invoice> & {
          id: string;
          clientName: string;
          items: InvoiceItem[];
        } = {
          id: genInvoiceId(),
          clientName: g.clientName,
          status: g.status,
          notes: g.notes || null,
          items,
          createdAt: g.createdAt,
          updatedAt: new Date().toISOString(),
        };
        try {
          await saveInvoice(invoice);
          imported++;
        } catch (err: any) {
          console.error("Import failed for one invoice", err);
        }
        done++;
        setProgress(Math.round((done / total) * 100));
        // Yield to the UI thread for smoother progress updates
        await new Promise((r) => setTimeout(r, 5));
      }

      setProgress(100);
      setProgressLabel("Terminé");
      await refresh();
      toast.success(
        `${imported} facture(s) importée(s) · ${totalItems} article(s)`
      );
      navigate("invoices");
    } catch (err: any) {
      toast.error(err?.message || "Échec de l'import");
    } finally {
      setImporting(false);
    }
  };

  // ---------- Render ----------

  return (
    <div className="min-h-screen flex flex-col">
      <ScreenHeader
        title="Import CSV"
        subtitle="Créer des factures depuis un fichier CSV"
        icon={UploadCloud}
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-slate-600"
            onClick={() => navigate("invoices")}
            disabled={importing}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour</span>
          </Button>
        }
      />

      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 max-w-5xl w-full mx-auto space-y-4">
        {/* Step 1: drop zone */}
        <SectionCard title="1. Choisir un fichier CSV">
          {!fileName ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleBrowseClick();
              }}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-[#2563EB] bg-[#2563EB]/5"
                  : "border-slate-300 bg-slate-50/40 hover:border-[#2563EB]/60 hover:bg-[#2563EB]/[0.03]"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleBrowseChange}
              />
              <div
                className={cn(
                  "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-colors",
                  dragOver
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-[#2563EB] border border-slate-200"
                )}
              >
                {parsing ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>
              <p className="text-[15px] font-bold text-slate-900">
                {parsing
                  ? "Analyse du fichier…"
                  : dragOver
                  ? "Déposez le fichier ici"
                  : "Glissez-déposez un fichier CSV"}
              </p>
              <p className="text-[13px] text-slate-500 mt-1">
                ou{" "}
                <span className="text-[#2563EB] font-semibold underline">
                  cliquez pour parcourir
                </span>
              </p>
              <p className="text-[11.5px] text-slate-400 mt-3">
                Format attendu : .csv avec en-tête (première ligne).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 truncate">
                  {fileName}
                </p>
                <p className="text-[12px] text-slate-500">
                  {rows.length} ligne(s) · {columns.length} colonne(s)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-slate-500 hover:text-red-600"
                onClick={resetFile}
                disabled={importing}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {parseError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{parseError}</p>
            </div>
          )}
        </SectionCard>

        {/* Step 2: preview */}
        {rows.length > 0 && (
          <SectionCard
            title="2. Aperçu des premières lignes"
            action={
              <Badge variant="secondary" className="rounded-full">
                {rows.length} lignes
              </Badge>
            }
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c}
                        className="text-left font-semibold text-slate-600 px-2 py-2 border-b border-slate-200 whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {columns.map((c) => (
                        <td
                          key={c}
                          className="px-2 py-2 border-b border-slate-100 text-slate-700 whitespace-nowrap max-w-[220px] truncate"
                        >
                          {r[c] || (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-slate-400 mt-2">
              Aperçu des 5 premières lignes sur {rows.length}.
            </p>
          </SectionCard>
        )}

        {/* Step 3: column mapping */}
        {columns.length > 0 && (
          <SectionCard
            title="3. Mapping des colonnes"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-[#2563EB]"
                onClick={() => autoDetectMapping(columns)}
                disabled={importing}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Auto-détection
              </Button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {FIELD_DEFS.map((f) => {
                const value = mapping[f.key] || "__none__";
                return (
                  <div
                    key={f.key}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Label
                        htmlFor={`map-${f.key}`}
                        className="text-[13px] font-semibold text-slate-800"
                      >
                        {f.label}
                      </Label>
                      {f.required ? (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] py-0 px-1.5 bg-red-100 text-red-700"
                        >
                          requis
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          optionnel
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-slate-500 mb-2">
                      {f.description}
                    </p>
                    <Select
                      value={value}
                      onValueChange={(v) =>
                        setMapping((prev) => ({
                          ...prev,
                          [f.key]: v === "__none__" ? undefined : v,
                        }))
                      }
                      disabled={importing}
                    >
                      <SelectTrigger
                        id={`map-${f.key}`}
                        className="w-full rounded-xl"
                      >
                        <SelectValue placeholder="— Aucune —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Aucune —</SelectItem>
                        {columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Step 4: mode + validation */}
        {columns.length > 0 && (
          <SectionCard title="4. Mode d'import">
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "merge" | "replace")}
              className="grid gap-2"
              disabled={importing}
            >
              <label
                htmlFor="mode-merge"
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  mode === "merge"
                    ? "border-[#2563EB] bg-[#2563EB]/5"
                    : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <RadioGroupItem
                  id="mode-merge"
                  value="merge"
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-[14px] font-semibold text-slate-900">
                      Ajouter / fusionner avec l'existant
                    </span>
                  </div>
                  <p className="text-[12.5px] text-slate-500 mt-0.5 leading-snug">
                    Les nouvelles factures sont ajoutées aux données actuelles.
                    Recommandé pour la plupart des cas.
                  </p>
                </div>
              </label>
              <label
                htmlFor="mode-replace"
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  mode === "replace"
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <RadioGroupItem
                  id="mode-replace"
                  value="replace"
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-red-600" />
                    <span className="text-[14px] font-semibold text-slate-900">
                      Remplacer toutes les données
                    </span>
                  </div>
                  <p className="text-[12.5px] text-red-600/80 mt-0.5 leading-snug">
                    Supprime les {existingInvoices.length} facture(s)
                    existante(s) avant l'import. Action irréversible.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {/* Validation summary */}
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Database className="w-4 h-4 text-[#2563EB]" />
                <span className="text-[13.5px] font-semibold">
                  Résumé de l'import
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
                <SummaryItem
                  label="Factures à importer"
                  value={String(groups.length)}
                  ok={groups.length > 0}
                />
                <SummaryItem
                  label="Articles"
                  value={String(totalItems)}
                  ok={totalItems > 0}
                />
                <SummaryItem
                  label="Mode"
                  value={mode === "merge" ? "Fusionner" : "Remplacer"}
                  ok
                />
              </div>
              {missingRequired.length > 0 && (
                <div className="mt-3 flex items-start gap-2 text-[12.5px] text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Champs obligatoires manquants :{" "}
                    <strong>
                      {missingRequired.map((f) => f.label).join(", ")}
                    </strong>
                    .
                  </span>
                </div>
              )}
              {groups.length === 0 &&
                missingRequired.length === 0 &&
                rows.length > 0 && (
                  <p className="mt-3 text-[12.5px] text-amber-700">
                    Aucune facture à importer à partir des colonnes mappées.
                  </p>
                )}
            </div>
          </SectionCard>
        )}

        {/* Progress */}
        {importing && (
          <SectionCard title="Import en cours">
            <div className="space-y-2">
              <Progress value={progress} className="h-2.5" />
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                  {progressLabel}
                </span>
                <span className="font-semibold text-slate-700">{progress}%</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Action buttons */}
        {columns.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pb-4">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => navigate("invoices")}
              disabled={importing}
            >
              <ArrowLeft className="w-4 h-4" />
              Annuler
            </Button>
            <Button
              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5"
              onClick={handleImport}
              disabled={!canImport}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Importer {groups.length > 0 ? `(${groups.length})` : ""}
            </Button>
          </div>
        )}

        {columns.length === 0 && !fileName && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
            <EmptyState
              icon={FileUp}
              title="Aucun fichier chargé"
              description="Déposez un fichier CSV ci-dessus pour démarrer l'import. Les colonnes seront détectées automatiquement et vous pourrez les mapper aux champs de facture."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-[15px] font-bold",
          ok ? "text-slate-900" : "text-red-600"
        )}
      >
        {value}
      </p>
    </div>
  );
}
