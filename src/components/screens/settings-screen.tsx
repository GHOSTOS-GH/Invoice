"use client";
// Settings screen — onglets : Boutique, Maintenance, Application (installation
// PWA, cache local) et Sauvegarde (CSV export, JSON backup, import CSV).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useSettings,
  updateSettings,
  useInvoices,
  useProducts,
  useClients,
  uploadImage,
} from "@/lib/data-hooks";
import { clearAllLocal, countPendingLocal, getDB, setMeta } from "@/lib/offline-db";
import { useSyncStatus } from "@/components/shared/sync-status";
import { usePwaInstall } from "@/components/pwa/use-pwa-install";
import { useNav } from "@/components/app-shell";
import {
  ScreenHeader,
  SectionCard,
  EmptyState,
  LoadingState,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Store,
  Users,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Save,
  AlertTriangle,
  ImageUp,
  Loader2,
  FileJson,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/constants";
import {
  formatCurrency,
  formatDateTime,
  escapeCsv,
  numStr,
  refId,
} from "@/lib/formatters";
import { invoiceTotal } from "@/lib/types";
import type { Settings as SettingsType } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Main screen ----------

export function SettingsScreen() {
  const { settings, loading } = useSettings();
  const [tab, setTab] = useState<string>("boutique");

  if (loading) {
    return (
      <div>
        <ScreenHeader
          title="Réglages"
          subtitle="Configuration de la boutique"
          icon={Settings}
        />
        <LoadingState message="Chargement des réglages…" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div>
        <ScreenHeader
          title="Réglages"
          subtitle="Configuration de la boutique"
          icon={Settings}
        />
        <EmptyState
          icon={AlertTriangle}
          title="Impossible de charger les réglages"
          description="Vérifiez votre connexion puis réessayez."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">        <ScreenHeader
          title="Réglages"
          subtitle="Boutique · maintenance · application · sauvegarde"
          icon={Settings}
        />
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 max-w-4xl w-full mx-auto">
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="bg-slate-100/80 p-1 h-auto rounded-2xl w-full overflow-x-auto flex justify-start sm:justify-center">
            <TabsTrigger
              value="boutique"
              className="rounded-xl px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm text-slate-600"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Boutique</span>
            </TabsTrigger>
            <TabsTrigger
              value="application"
              className="rounded-xl px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm text-slate-600"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Application</span>
            </TabsTrigger>
            <TabsTrigger
              value="sauvegarde"
              className="rounded-xl px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm text-slate-600"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Sauvegarde</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boutique" className="mt-0 outline-none">
            <BoutiqueTab settings={settings} />
          </TabsContent>
          <TabsContent value="application" className="mt-0 outline-none">
            <ApplicationTab />
          </TabsContent>
          <TabsContent value="sauvegarde" className="mt-0 outline-none">
            <SauvegardeTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------- Tab 1: Boutique ----------

function BoutiqueTab({ settings }: { settings: SettingsType }) {
  const [shopName, setShopName] = useState(settings.shopName || "");
  const [shopAddress, setShopAddress] = useState(settings.shopAddress || "");
  const [shopPhone, setShopPhone] = useState(settings.shopPhone || "");
  const [shopNinea, setShopNinea] = useState(settings.shopNinea || "");
  const [footerMessage, setFooterMessage] = useState(settings.footerMessage || "");
  const [logoUrl, setLogoUrl] = useState<string | null>(
    settings.logoUrl || null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when settings are refreshed from server
  useEffect(() => {
    setShopName(settings.shopName || "");
    setShopAddress(settings.shopAddress || "");
    setShopPhone(settings.shopPhone || "");
    setShopNinea(settings.shopNinea || "");
    setFooterMessage(settings.footerMessage || "");
    setLogoUrl(settings.logoUrl || null);
  }, [settings]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("L'image dépasse 4 Mo");
      return;
    }
    setUploading(true);
    try {
      // Local preview immediately
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
      // Upload to server
      const url = await uploadImage(file);
      setLogoUrl(url);
      toast.success("Logo téléversé");
    } catch (err: any) {
      toast.error(err?.message || "Échec du téléversement");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      toast.error("Le nom de la boutique est obligatoire");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopPhone: shopPhone.trim(),
        shopNinea: shopNinea.trim(),
        footerMessage: footerMessage.trim(),
        logoUrl,
      });
      toast.success("Réglages enregistrés");
    } catch (err: any) {
      toast.error(err?.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Informations de la boutique">
        <div className="space-y-4">
          <div>
            <Label htmlFor="shop-name" className="text-[13px] font-semibold text-slate-700">
              Nom de la boutique *
            </Label>
            <Input
              id="shop-name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Konté Services"
              className="mt-1.5 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="shop-address" className="text-[13px] font-semibold text-slate-700">
              Adresse
            </Label>
            <Textarea
              id="shop-address"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="Rue, ville, pays"
              className="mt-1.5 rounded-xl min-h-[72px]"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shop-phone" className="text-[13px] font-semibold text-slate-700">
                Téléphone
              </Label>
              <Input
                id="shop-phone"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="shop-ninea" className="text-[13px] font-semibold text-slate-700">
                NINEA
              </Label>
              <Input
                id="shop-ninea"
                value={shopNinea}
                onChange={(e) => setShopNinea(e.target.value)}
                placeholder="Numéro d'identification"
                className="mt-1.5 rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="footer-message" className="text-[13px] font-semibold text-slate-700">
              Message de bas de page (factures)
            </Label>
            <Textarea
              id="footer-message"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              placeholder="Merci de votre confiance — Konté Services"
              className="mt-1.5 rounded-xl min-h-[60px]"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Logo de la boutique">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-24 h-24 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo boutique"
                className="w-full h-full object-contain"
              />
            ) : (
              <Store className="w-9 h-9 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Le logo apparaît sur les factures PDF et en-tête de l'application.
              Formats acceptés : PNG, JPG, WebP — 4 Mo max.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageUp className="w-4 h-4" />
                )}
                {uploading ? "Téléversement…" : "Choisir une image"}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setLogoUrl(null)}
                  disabled={uploading}
                >
                  Retirer
                </Button>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 h-10"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  );
}

// ---------- Tab 2: Application (PWA + outils locaux) ----------

function ApplicationTab() {
  const { forceSync } = useSyncStatus();
  const { canInstall, promptInstall, isInstalled } = usePwaInstall();
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheCount, setCacheCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  const [forcingSync, setForcingSync] = useState(false);

  const refreshLocalCounts = async () => {
    setPendingCount(await countPendingLocal());
    try {
      const db = getDB();
      const counts = await Promise.all([db.invoices.count(), db.clients.count(), db.products.count()]);
      setCacheCount(counts.reduce((sum, count) => sum + count, 0));
    } catch {
      setCacheCount(0);
    }
  };

  useEffect(() => {
    refreshLocalCounts();
    const interval = window.setInterval(refreshLocalCounts, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const clearPending = async () => {
    if (!window.confirm("Abandonner les données locales non sauvegardées en ligne ? Elles seront définitivement perdues.")) return;
    try {
      await getDB().invoices.where("syncState").equals("local").modify({ syncState: "saved" });
      await getDB().clients.where("syncState").equals("local").modify({ syncState: "saved" });
      await getDB().products.where("syncState").equals("local").modify({ syncState: "saved" });
      await setMeta("tombstones", []);
      await refreshLocalCounts();
      toast.success("Données locales marquées comme sauvegardées");
    } catch {
      toast.error("Impossible de vider les données locales");
    }
  };

  const forcePendingSync = async () => {
    setForcingSync(true);
    const results = await forceSync();
    setSyncMessage(
      results.ok === 0 && results.failed === 0
        ? "Aucun élément à envoyer. Vérifiez la connexion et la session."
        : `${results.ok} succès, ${results.failed} échec(s)${results.message ? ` : ${results.message}` : ""}`
    );
    await refreshLocalCounts();
    window.dispatchEvent(new Event("invoice-sync-request"));
    setForcingSync(false);
  };

  const resetCache = async () => {
    if (!window.confirm("Réinitialiser tout le cache local ?")) return;
    await clearAllLocal();
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Installation de l'application">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            {isInstalled ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Application installée</p>
                  <p className="text-[12.5px] text-slate-500">
                    Vous utilisez déjà l'application en plein écran.
                  </p>
                </div>
              </div>
            ) : canInstall ? (
              <>
                <p className="text-[14px] font-semibold text-slate-900">Installer sur votre appareil</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">
                  Ajoutez l'application à votre écran d'accueil pour un accès
                  rapide et le fonctionnement hors ligne.
                </p>
                <Button
                  onClick={promptInstall}
                  className="mt-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-1.5" /> Installer l'application
                </Button>
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-slate-900">Installation manuelle</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">
                  <strong className="text-slate-700">Android / Chrome</strong> : menu ⋮ → « Installer l'application ».
                  <br />
                  <strong className="text-slate-700">iPhone / Safari</strong> : bouton Partager → « Sur l'écran d'accueil ».
                </p>
              </>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Données locales">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Envoi direct au serveur</p>
              <p className="text-[12px] text-slate-500">Réessaie l'envoi des données enregistrées localement.</p>
            </div>
            <Button variant="outline" size="sm" onClick={forcePendingSync} disabled={forcingSync || pendingCount === 0}>{forcingSync ? "Envoi…" : "Réessayer"}</Button>
          </div>
          {syncMessage && <p className="text-[12px] text-slate-600 rounded-lg bg-slate-50 p-2">{syncMessage}</p>}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Abandonner les données non sauvegardées</p>
              <p className="text-[12px] text-slate-500">{pendingCount} donnée{pendingCount !== 1 ? "s" : ""} uniquement locale{pendingCount !== 1 ? "s" : ""}</p>
            </div>
            <Button variant="outline" size="sm" onClick={clearPending} disabled={pendingCount === 0}>Abandonner</Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Réinitialiser le cache local</p>
              <p className="text-[12px] text-slate-500">{cacheCount} donnée{cacheCount !== 1 ? "s" : ""} en cache local{cacheCount !== 1 ? "s" : ""}</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetCache} disabled={cacheCount === 0}>Réinitialiser</Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------- Tab 3: Sauvegarde ----------

function SauvegardeTab() {
  const { invoices } = useInvoices();
  const { products } = useProducts();
  const { clients } = useClients();
  const { navigate } = useNav();
  const [exporting, setExporting] = useState(false);

  const stats = useMemo(() => {
    return {
      invoices: invoices.length,
      products: products.length,
      clients: clients.length,
      items: invoices.reduce((s, inv) => s + (inv.items?.length || 0), 0),
    };
  }, [invoices, products, clients]);

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportCsv = () => {
    if (invoices.length === 0) {
      toast.error("Aucune facture à exporter");
      return;
    }
    setExporting(true);
    try {
      const header = [
        "Date",
        "Réf",
        "Client",
        "Statut",
        "Article",
        "Quantité",
        "Prix unitaire",
        "Sous-total",
        "Total facture",
        "Notes",
      ];
      const rows: string[] = [header.map(escapeCsv).join(";")];
      // Sort invoices newest first
      const sorted = [...invoices].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      for (const inv of sorted) {
        const date = formatDateTime(inv.createdAt);
        const ref = refId(inv.id);
        const client = inv.clientName || "";
        const statusLabel = INVOICE_STATUS_META[inv.status]?.label || inv.status;
        const totalFacture = numStr(invoiceTotal(inv.items || []));
        const notes = inv.notes || "";
        const items = inv.items?.length
          ? inv.items
          : [{ name: "", quantity: 0, unitPrice: 0 }];
        for (const it of items) {
          const sousTotal = numStr(
            (it.quantity || 0) * (it.unitPrice || 0)
          );
          rows.push(
            [
              date,
              ref,
              client,
              statusLabel,
              it.name || "",
              numStr(it.quantity || 0),
              numStr(it.unitPrice || 0),
              sousTotal,
              totalFacture,
              notes,
            ]
              .map(String)
              .map(escapeCsv)
              .join(";")
          );
        }
      }
      // Prepend UTF-8 BOM for Excel accent compatibility
      const csv = "\uFEFF" + rows.join("\r\n");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(csv, `factures_${stamp}.csv`, "text/csv");
      toast.success(`${invoices.length} facture(s) exportée(s) en CSV`);
    } catch (err: any) {
      toast.error(err?.message || "Échec de l'export CSV");
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = () => {
    if (invoices.length === 0 && products.length === 0 && clients.length === 0) {
      toast.error("Aucune donnée à sauvegarder");
      return;
    }
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        app: "Facturier Konté",
        version: 1,
        invoices,
        products,
        clients,
      };
      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(json, `backup_facturier_${stamp}.json`, "application/json");
      toast.success("Sauvegarde JSON téléchargée");
    } catch (err: any) {
      toast.error(err?.message || "Échec de la sauvegarde JSON");
    } finally {
      setExporting(false);
    }
  };

  const handleGoImportCsv = () => {
    navigate("csv-import");
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Résumé des données">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Factures" value={stats.invoices} icon={FileSpreadsheet} />
          <StatBox label="Articles" value={stats.items} icon={FileSpreadsheet} />
          <StatBox label="Produits" value={stats.products} icon={Database} />
          <StatBox label="Clients" value={stats.clients} icon={Users} />
        </div>
        <p className="text-[12.5px] text-slate-400 mt-3 leading-relaxed">
          {stats.invoices} facture(s) · {stats.products} produit(s) ·{" "}
          {stats.clients} client(s)
        </p>
      </SectionCard>

      <SectionCard title="Export & sauvegarde">
        <div className="space-y-3">
          <ActionRow
            icon={FileSpreadsheet}
            title="Exporter les factures en CSV"
            description="Une ligne par article, format français (séparateur « ; »), compatible Excel."
            action={
              <Button
                onClick={handleExportCsv}
                disabled={exporting || invoices.length === 0}
                variant="outline"
                className="rounded-xl"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export CSV
              </Button>
            }
          />
          <div className="h-px bg-slate-100" />
          <ActionRow
            icon={FileJson}
            title="Sauvegarde JSON complète"
            description="Factures, produits et clients dans un seul fichier .json."
            action={
              <Button
                onClick={handleExportJson}
                disabled={exporting}
                variant="outline"
                className="rounded-xl"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Backup JSON
              </Button>
            }
          />
          <div className="h-px bg-slate-100" />
          <ActionRow
            icon={Upload}
            title="Importer un fichier CSV"
            description="Créer des factures à partir d'un fichier CSV (mapping de colonnes)."
            action={
              <Button
                onClick={handleGoImportCsv}
                className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
            }
          />
        </div>
      </SectionCard>

      <SectionCard title="Statuts de factures">
        <div className="flex flex-wrap gap-2">
          {INVOICE_STATUSES.map((s) => {
            const meta = INVOICE_STATUS_META[s];
            const count = invoices.filter((i) => i.status === s).length;
            return (
              <Badge
                key={s}
                variant="secondary"
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold border",
                  meta.bg,
                  meta.text,
                  "border-transparent"
                )}
              >
                {meta.label} · {count}
              </Badge>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: any;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-slate-900 mt-1">
        {value.toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-1">
      <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#2563EB]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-slate-900">{title}</p>
        <p className="text-[12.5px] text-slate-500 leading-snug">
          {description}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
