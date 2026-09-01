// PDF generation with jsPDF — reproduces lib/services/pdf_service.dart layout:
// header, status badge, client box, items table, gradient total box, notes, footer.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice } from "./types";
import {
  invoiceTotal,
  invoiceTotalQuantity,
  itemSubtotal,
} from "./types";
import {
  formatCurrency,
  formatDateTime,
  refId,
} from "./formatters";
import { INVOICE_STATUS_META } from "./constants";

const COLORS = {
  blue: [37, 99, 235] as [number, number, number],
  blueDark: [29, 78, 216] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  grey: [100, 116, 139] as [number, number, number],
  lightBg: [241, 245, 254] as [number, number, number],
  border: [224, 233, 248] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export async function generateInvoicePdf(invoice: Invoice): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  const total = invoiceTotal(invoice.items);
  const qty = invoiceTotalQuantity(invoice.items);
  const statusMeta = INVOICE_STATUS_META[invoice.status];

  // ---------- Header ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...COLORS.blueDark);
  doc.text("FACTURE", margin, 70, { charSpace: 3 });

  // Ref
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.grey);
  doc.text("RÉF:", margin, 90);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.blue);
  doc.text(refId(invoice.id), margin + 28, 90);

  // Date
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.grey);
  doc.setFillColor(...COLORS.blue);
  doc.circle(margin + 3, 103, 2, "F");
  doc.text(formatDateTime(invoice.createdAt), margin + 12, 106);

  // Status badge (top right)
  const badgeX = pageWidth - margin - 80;
  const [br, bg, bb] = hexToRgb(statusMeta.color);
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(badgeX, 55, 80, 24, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(statusMeta.label, badgeX + 40, 71, { align: "center" });

  // Divider
  doc.setFillColor(...COLORS.blue);
  doc.roundedRect(margin, 125, 60, 3, 1.5, 1.5, "F");

  // ---------- Client box ----------
  const clientBoxY = 150;
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(margin, clientBoxY, pageWidth - margin * 2, 56, 8, 8, "FD");

  // Initials badge
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin + 14, clientBoxY + 14, 28, 28, 6, 6, "F");
  const initials = invoice.clientName
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.blue);
  doc.text(initials, margin + 28, clientBoxY + 33, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grey);
  doc.text("CLIENT", margin + 54, clientBoxY + 22, { charSpace: 2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.dark);
  doc.text(invoice.clientName, margin + 54, clientBoxY + 40);

  // ---------- Items table ----------
  autoTable(doc, {
    startY: clientBoxY + 80,
    head: [["ARTICLE", "QTÉ", "PRIX UNIT.", "SOUS-TOTAL"]],
    body: invoice.items.map((it) => [
      it.name,
      String(it.quantity),
      formatCurrency(it.unitPrice),
      formatCurrency(itemSubtotal(it)),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: COLORS.blue,
      textColor: COLORS.white,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: "auto" },
      1: { halign: "center", cellWidth: 50 },
      2: { halign: "right", cellWidth: 110 },
      3: { halign: "right", cellWidth: 110, textColor: COLORS.blue, fontStyle: "bold" },
    },
    bodyStyles: { fontSize: 10, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: [249, 251, 254] },
    margin: { left: margin, right: margin },
  });

  // ---------- Total box ----------
  // @ts-ignore — autoTable adds lastAutoTable
  const afterTableY = (doc as any).lastAutoTable.finalY + 24;
  const boxW = 290;
  const boxH = 120;
  const boxX = pageWidth - margin - boxW;

  // Gradient simulation: draw several rects with decreasing blue
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(COLORS.blue[0] + (COLORS.blueDark[0] - COLORS.blue[0]) * t);
    const g = Math.round(COLORS.blue[1] + (COLORS.blueDark[1] - COLORS.blue[1]) * t);
    const b = Math.round(COLORS.blue[2] + (COLORS.blueDark[2] - COLORS.blue[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(boxX + (boxW / steps) * i, afterTableY, boxW / steps + 0.5, boxH, "F");
  }
  // Round the corners by overdrawing white outside (simplified: just outline)
  doc.setFillColor(...COLORS.blue);
  doc.roundedRect(boxX, afterTableY, boxW, boxH, 10, 10, "F");
  // Redraw gradient on top with clip
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(COLORS.blue[0] + (COLORS.blueDark[0] - COLORS.blue[0]) * t);
    const g = Math.round(COLORS.blue[1] + (COLORS.blueDark[1] - COLORS.blue[1]) * t);
    const b = Math.round(COLORS.blue[2] + (COLORS.blueDark[2] - COLORS.blue[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(boxX + (boxW / steps) * i, afterTableY + 4, boxW / steps + 0.5, boxH - 8, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", boxX + 18, afterTableY + 24, { charSpace: 2 });
  doc.setFontSize(26);
  doc.text(formatCurrency(total), boxX + 18, afterTableY + 50);

  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.2 }));
  doc.line(boxX + 18, afterTableY + 62, boxX + boxW - 18, afterTableY + 62);
  doc.setGState(doc.GState({ opacity: 1 }));

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("Articles:", boxX + 18, afterTableY + 80);
  doc.setFont("helvetica", "bold");
  doc.text(String(invoice.items.length), boxX + boxW - 18, afterTableY + 80, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.text("Unités totales:", boxX + 18, afterTableY + 95);
  doc.setFont("helvetica", "bold");
  doc.text(String(qty), boxX + boxW - 18, afterTableY + 95, { align: "right" });

  // ---------- Notes ----------
  if (invoice.notes) {
    const notesY = afterTableY + boxH + 20;
    doc.setFillColor(255, 251, 239);
    doc.setDrawColor(252, 239, 192);
    doc.roundedRect(margin, notesY, pageWidth - margin * 2, 50, 8, 8, "FD");
    doc.setFillColor(217, 165, 25);
    doc.circle(margin + 14, notesY + 18, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text("Notes", margin + 24, notesY + 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.grey);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2 - 36);
    doc.text(splitNotes, margin + 18, notesY + 38);
  }

  // ---------- Footer ----------
  doc.setDrawColor(236, 240, 246);
  doc.line(margin, pageHeight - 50, pageWidth - margin, pageHeight - 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.blue);
  doc.text("Facturier Konté Bussness Services", pageWidth / 2, pageHeight - 36, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grey);
  doc.text("Solution conçue par Mohamed", pageWidth / 2, pageHeight - 26, { align: "center" });

  return doc.output("blob");
}
