// Shared export utilities — CSV (semicolon, French) + Excel (.xlsx via SheetJS).
// Format is compatible with the CSV import screen for round-trip export → reimport.

import * as XLSX from "xlsx";
import { escapeCsv, numStr } from "./formatters";

/** Trigger a browser download for a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convert a 2D array of rows into semicolon-separated CSV with UTF-8 BOM. */
export function rowsToCsv(rows: (string | number)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((r) => r.map((c) => escapeCsv(String(c))).join(";"))
      .join("\r\n")
  );
}

/** Export rows as a CSV file download. */
export function exportCsv(rows: (string | number)[][], filename: string) {
  const csv = rowsToCsv(rows);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/** Export rows as an Excel .xlsx file download. */
export function exportExcel(
  rows: (string | number)[][],
  filename: string,
  sheetName = "Données"
) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Set column widths based on content
  const colWidths = rows[0]?.map((_, colIdx) => {
    const maxLen = Math.max(
      ...rows.map((r) => String(r[colIdx] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  }) || [];
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ---------- Invoice export ----------

export function invoicesToRows(invoices: any[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
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
    ],
  ];
  for (const inv of invoices) {
    const date = new Date(inv.createdAt).toLocaleString("fr-FR");
    const ref = inv.id.length >= 6 ? `#${inv.id.slice(-6)}` : inv.id;
    const total = numStr(
      inv.items.reduce(
        (s: number, it: any) => s + it.quantity * it.unitPrice,
        0
      )
    );
    const notes = inv.notes ?? "";
    for (const item of inv.items) {
      rows.push([
        date,
        ref,
        inv.clientName,
        inv.status,
        item.name,
        item.quantity,
        numStr(item.unitPrice),
        numStr(item.quantity * item.unitPrice),
        total,
        notes,
      ]);
    }
  }
  return rows;
}

// ---------- Client export ----------

export function clientsToRows(clients: any[]): (string | number)[][] {
  const rows: (string | number)[][] = [["Nom", "Téléphone", "Adresse"]];
  for (const c of clients) {
    rows.push([c.name, c.phone ?? "", c.address ?? ""]);
  }
  return rows;
}

// ---------- Product export ----------

export function productsToRows(products: any[]): (string | number)[][] {
  const rows: (string | number)[][] = [["Nom", "Catégorie", "Image URL"]];
  for (const p of products) {
    rows.push([p.name, p.category, p.imageUrl ?? ""]);
  }
  return rows;
}
