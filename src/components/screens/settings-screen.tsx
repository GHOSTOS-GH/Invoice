"use client";
// Settings screen — reproduces settings_screen.dart + receipt settings:
// tabbed UI with Boutique info, Maintenance mode, Comptes (UsersScreen) and
// Sauvegarde (CSV export, JSON backup, CSV import shortcut).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import {
  useSettings,
  updateSettings,
  useInvoices,
  useProducts,
  useClients,
  uploadImage,
} from "@/lib/data-hooks";
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
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Store,
  Wrench,
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
  HardHat,
  ShieldAlert,
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

// Lazy-load the UsersScreen so the Comptes tab doesn't break the whole
// settings screen if the module is not yet present at build time.
const LazyUsersScreen = dynamic(
  () =>
    import("@/components/screens/users-screen").then((m) => m.UsersScreen),
  {
    ssr: false,
    loading: () => <LoadingState message="Chargement des comptes…" />,
  }
);

class UsersTabBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // swallow — the fallback note will be shown
  }
  render() {
    if (this.state.failed) return <ComptesNote />;
    return this.props.children;
  }
}

function ComptesNote() {
  return (
    <SectionCard title="Comptes utilisateurs">
      <EmptyState
        icon={Users}
        title="Voir l'onglet Comptes"
        description="La gestion des comptes est accessible depuis le menu « Comptes » de la barre latérale (réservé aux administrateurs)."
      />
    </SectionCard>
  );
}

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
    <div className="min-h-screen flex flex-col">
      <ScreenHeader
        title="Réglages"
        subtitle="Boutique · maintenance · comptes · sauvegarde"
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
              value="maintenance"
              className="rounded-xl px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm text-slate-600"
            >
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Maintenance</span>
            </TabsTrigger>
            <TabsTrigger
              value="comptes"
              className="rounded-xl px-3 py-2 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm text-slate-600"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Comptes</span>
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
          <TabsContent value="maintenance" className="mt-0 outline-none">
            <MaintenanceTab settings={settings} />
          </TabsContent>
          <TabsContent value="comptes" className="mt-0 outline-none">
            <UsersTabBoundary>
              <LazyUsersScreen />
            </UsersTabBoundary>
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

// ---------- Tab 2: Maintenance ----------

function MaintenanceTab({ settings }: { settings: SettingsType }) {
  const [maintenanceMode, setMaintenanceMode] = useState(
    settings.maintenanceMode || false
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMaintenanceMode(!!settings.maintenanceMode);
  }, [settings.maintenanceMode]);

  const handleToggle = async (checked: boolean) => {
    setMaintenanceMode(checked);
    setSaving(true);
    try {
      await updateSettings({ maintenanceMode: checked });
      toast.success(
        checked
          ? "Mode maintenance activé"
          : "Mode maintenance désactivé"
      );
    } catch (err: any) {
      // Revert on failure
      setMaintenanceMode(!checked);
      toast.error(err?.message || "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-5 sm:p-6 transition-colors",
          maintenanceMode
            ? "border-red-200 bg-red-50/60"
            : "border-slate-200 bg-white"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              maintenanceMode
                ? "bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-400"
            )}
          >
            <HardHat className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  Mode maintenance
                </h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  Restreint l'accès aux administrateurs uniquement.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
                <span
                  className={cn(
                    "text-[12px] font-semibold px-2.5 py-1 rounded-full transition-colors",
                    maintenanceMode
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {maintenanceMode ? "ACTIF" : "Inactif"}
                </span>
                {/* Large custom switch with red accent when ON */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={maintenanceMode}
                  onClick={() => handleToggle(!maintenanceMode)}
                  disabled={saving}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400 disabled:opacity-60",
                    maintenanceMode ? "bg-red-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
                      maintenanceMode ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {maintenanceMode && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13.5px] font-semibold text-amber-800">
                Site en maintenance
              </p>
              <p className="text-[13px] text-amber-700 mt-1 leading-relaxed">
                Le site est actuellement en mode maintenance. Seuls les
                administrateurs peuvent y accéder.
              </p>
            </div>
          </div>
        </div>
      )}

      <SectionCard title="Comportement">
        <ul className="space-y-2.5 text-[13px] text-slate-600">
          <li className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Les utilisateurs non-administrateurs voient un écran « Site
              actuellement fermé » et ne peuvent pas se connecter à l'espace
              de gestion.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Les administrateurs conservent un accès complet pour tester,
              corriger ou préparer une mise à jour.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Désactivez le mode maintenance une fois les opérations terminées
              pour rendre l'application à nouveau disponible.
            </span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

// ---------- Tab 4: Sauvegarde ----------

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
