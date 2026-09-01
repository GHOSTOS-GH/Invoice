// GET /api/invoices/[id] — fetch one invoice with items
// PUT /api/invoices/[id] — create or update (upsert) with items
// DELETE /api/invoices/[id] — delete invoice + items
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice || invoice.createdBy !== user.id) {
      return Response.json({ error: "Facture introuvable" }, { status: 404 });
    }
    return Response.json(invoice);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const { clientName, clientId, status, notes, discount, taxRate, items, createdAt } = body;

    // Upsert invoice + items in a transaction
    const saved = await db.$transaction(async (tx) => {
      // Delete existing items first (for updates)
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const data: any = {
        clientName: String(clientName || "").trim(),
        clientId: clientId || null,
        status: status || "enCours",
        notes: notes ?? null,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
        createdBy: user.id,
        updatedAt: new Date(),
      };
      if (createdAt) data.createdAt = new Date(createdAt);

      const invoice = await tx.invoice.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });

      if (Array.isArray(items) && items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map((it: any) => ({
            id: it.id || undefined,
            invoiceId: id,
            name: String(it.name),
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
          })),
        });
      }

      return tx.invoice.findUnique({ where: { id }, include: { items: true } });
    });

    return Response.json(saved);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing || existing.createdBy !== user.id) {
      return Response.json({ error: "Facture introuvable" }, { status: 404 });
    }
    await db.invoice.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
