"use client";
// Products screen — reproduces product_grid_sheet.dart + product_form_dialog.dart
// and the products tab of settings. Grid of products with category tabs, search,
// add/edit dialog with image upload (compressed via canvas before upload).

import {
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  useProducts,
  createProduct,
  saveProduct,
  deleteProduct,
  uploadImage,
} from "@/lib/data-hooks";
import {
  ScreenHeader,
  EmptyState,
  LoadingState,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Loader2,
  RefreshCw,
  Tag,
  Image as ImageIcon,
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import {
  exportCsv,
  exportExcel,
  productsToRows,
} from "@/lib/export-utils";

// ---------- Image compression helper ----------
// Reads the file, downscales to maxDim on the longest side, and re-encodes as
// JPEG with the given quality. Returns the original file if it cannot be
// processed (SVG, GIF, non-image).
async function compressImage(
  file: File,
  maxDim = 800,
  quality = 0.8
): Promise<File> {
  const debug = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") console.debug("[product-image]", ...args);
  };
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    debug("Compression ignorée", file.type);
    return file;
  }
  debug("Lecture du fichier", file.name, file.size);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Lecture du fichier échouée (FileReader)"));
    fr.readAsDataURL(file);
  });
  debug("FileReader terminé");
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = document.createElement("img");
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Chargement de l'image échoué"));
    i.src = dataUrl;
  });
  debug("Image chargée", img.width, img.height);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    debug("Canvas 2D indisponible, fallback original");
    return file;
  }
  // Paint a white background so transparent PNGs don't become black on JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob | null = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    } catch {
      reject(new Error("Compression canvas.toBlob non supportée"));
    }
  });
  if (!blob) {
    debug("canvas.toBlob a renvoyé null, fallback original");
    return file;
  }
  debug("Compression terminée", blob.size);
  const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], renamed, { type: "image/jpeg" });
}

// ---------- Product form dialog ----------
interface ProductFormValues {
  id?: string;
  name: string;
  category: string;
  imageUrl?: string | null;
}

function ProductFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProductFormValues | null;
  categories: string[];
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  // Track locally-created object URLs so we can revoke them.
  const localUrlRef = useRef<string | null>(null);

  // Reset state when the dialog opens.
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCategory(initial?.category ?? "");
      setImageUrl(initial?.imageUrl ?? null);
      setPreview(initial?.imageUrl ?? null);
    } else {
      // Revoke any local object URL when closing.
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current);
        localUrlRef.current = null;
      }
    }
  }, [open, initial]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    };
  }, []);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir un fichier image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop lourde (max 8 Mo)");
      return;
    }
    // Show local preview immediately.
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    const url = URL.createObjectURL(file);
    localUrlRef.current = url;
    setPreview(url);
    // Compress + upload.
    try {
      setUploading(true);
      let remoteUrl: string;
      try {
        const compressed = await compressImage(file);
        remoteUrl = await uploadImage(compressed);
      } catch (compressionError) {
        const message = compressionError instanceof Error ? compressionError.message : "erreur inconnue";
        if (process.env.NODE_ENV !== "production") console.debug("[product-image] fallback original", message);
        toast.error(`Compression impossible : ${message}. Envoi du fichier original…`);
        remoteUrl = await uploadImage(file);
      }
      setImageUrl(remoteUrl);
      toast.success("Image téléversée");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erreur";
      toast.error("Échec du téléversement: " + msg);
      setImageUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
    setPreview(null);
    setImageUrl(null);
    setFileKey((k) => k + 1);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedCat = category.trim();
    if (!trimmedName) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!trimmedCat) {
      toast.error("La catégorie est obligatoire");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial?.id) {
        await saveProduct({
          id: initial.id,
          name: trimmedName,
          category: trimmedCat,
          imageUrl: imageUrl ?? null,
        });
        toast.success("Produit mis à jour");
      } else {
        await createProduct({
          name: trimmedName,
          category: trimmedCat,
          imageUrl: imageUrl ?? undefined,
        });
        toast.success("Produit ajouté au catalogue");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erreur";
      toast.error("Échec de l'enregistrement: " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le produit" : "Nouveau produit"}
          </DialogTitle>
          <DialogDescription>
            Renseignez le nom, la catégorie et une image (optionnelle).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image preview / picker */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-full aspect-square max-w-[180px] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
              {preview ? (
                <Image
                  src={preview}
                  alt="Aperçu du produit"
                  fill
                  sizes="180px"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-[11px]">Aucune image</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
                </div>
              )}
              {preview && !uploading && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors"
                  aria-label="Retirer l'image"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              key={fileKey}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || busy}
              className="rounded-xl"
            >
              <ImagePlus className="w-4 h-4 mr-1.5" />
              {preview ? "Changer l'image" : "Choisir une image"}
            </Button>
            <p className="text-[11px] text-slate-400 text-center leading-snug">
              Compression automatique (max 800px, qualité 80%)
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Nom du produit</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Sac à dos cuir"
              className="rounded-xl"
              autoFocus
              maxLength={120}
            />
          </div>

          {/* Category with datalist of existing categories */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-cat">Catégorie</Label>
            <Input
              id="prod-cat"
              list="prod-cat-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex : Accessoires"
              className="rounded-xl"
              maxLength={60}
            />
            <datalist id="prod-cat-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="text-[11px] text-slate-400">
              Choisissez une catégorie existante ou créez-en une nouvelle.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-xl"
          >
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={busy || uploading}
            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5" />
            )}
            {isEdit ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Products screen ----------
export function ProductsScreen() {
  const { products, loading, refresh } = useProducts();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("Tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportCsv(productsToRows(products), `produits_${date}.csv`);
    toast.success("Produits exportés en CSV");
  };

  const handleExportExcel = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await exportExcel(productsToRows(products), `produits_${date}.xlsx`, "Produits");
    toast.success("Produits exportés en Excel");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const Papa = (await import("papaparse")).default;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rows = res.data as Record<string, string>[];
          let count = 0;
          for (const row of rows) {
            const name = (row["Nom"] ?? row["name"] ?? "").trim();
            const category = (row["Catégorie"] ?? row["category"] ?? "").trim();
            if (!name || !category) continue;
            const imageUrl = (row["Image URL"] ?? row["imageUrl"] ?? "").trim();
            await createProduct({
              name,
              category,
              imageUrl: imageUrl || undefined,
            });
            count++;
          }
          toast.success(`${count} produit(s) importé(s)`);
          refresh();
        } catch (err: any) {
          toast.error(err.message || "Erreur lors de l'import");
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        toast.error(err.message || "Erreur de lecture du fichier");
        setImporting(false);
      },
    });
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat !== "Tous") {
      list = list.filter((p) => (p.category || "").trim() === activeCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeCat, search]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing({
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl ?? null,
    });
    setDialogOpen(true);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteProduct(confirmDelete.id);
      toast.success("Produit supprimé");
      setConfirmDelete(null);
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erreur";
      toast.error("Suppression échouée: " + msg);
    }
  };

  return (
    <div>
      <ScreenHeader
        title="Produits"
        subtitle={`${products.length} produit${
          products.length > 1 ? "s" : ""
        } au catalogue`}
        icon={Package}
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="rounded-xl h-9 px-3"
              aria-label="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              disabled={importing}
              className="rounded-xl h-9"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1.5" />
              )}
              Importer CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-9">
                  <Download className="w-4 h-4 mr-1.5" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCsv}>
                  <FileText className="w-4 h-4 mr-2" />
                  Exporter CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exporter Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              onClick={openNew}
              className="rounded-xl h-9 bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Ajouter
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-10 rounded-xl pl-9 border-slate-200"
          />
        </div>

        {/* Category tabs (horizontal scrollable chips) */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
          <CategoryChip
            label="Tous"
            active={activeCat === "Tous"}
            onClick={() => setActiveCat("Tous")}
            count={products.length}
          />
          {categories.map((c) => {
            const count = products.filter(
              (p) => (p.category || "").trim() === c
            ).length;
            return (
              <CategoryChip
                key={c}
                label={c}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
                count={count}
              />
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length === 0 ? "Aucun produit" : "Aucun résultat"}
            description={
              products.length === 0
                ? "Ajoutez votre premier produit pour le retrouver lors de la création de factures."
                : "Ajustez votre recherche ou changez de catégorie."
            }
            action={
              products.length === 0 ? (
                <Button
                  onClick={openNew}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8]"
                >
                  <Plus className="w-4 h-4 mr-2" /> Ajouter un produit
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        categories={categories}
        onSaved={refresh}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-slate-700">
                {confirmDelete?.name}
              </span>{" "}
              sera retiré du catalogue. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-all",
        active
          ? "bg-[#2563EB] text-white border-transparent shadow-sm shadow-blue-500/20"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      )}
    >
      <Tag className="w-3 h-3" />
      <span className="max-w-[140px] truncate">{label}</span>
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
      <div className="aspect-square bg-slate-100 relative">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Package className="w-10 h-10" />
          </div>
        )}
        {/* Category badge */}
        {product.category && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/95 text-slate-700 backdrop-blur shadow-sm max-w-[80%] truncate">
            {product.category}
          </span>
        )}
        {/* Hover actions (always visible on mobile) */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-700 hover:text-[#2563EB] hover:scale-105 transition-all"
            aria-label={`Modifier ${product.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-700 hover:text-red-600 hover:scale-105 transition-all"
            aria-label={`Supprimer ${product.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
        <p className="font-semibold text-slate-900 text-[13px] sm:text-[14px] leading-tight line-clamp-2">
          {product.name}
        </p>
      </div>
    </div>
  );
}
