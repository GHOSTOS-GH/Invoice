// GET /api/invoices/[id] — fetch one invoice with items
// PUT /api/invoices/[id] — create or update (upsert) with items
// DELETE /api/invoices/[id] — delete invoice + items
// Isolation : toute opération vérifie que la facture appartient au compte connecté.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveClient();
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
    const user = await requireActiveClient();
    const { id } = await params;
    const body = await req.json();
    const { clientName, clientId, status, notes, items, createdAt } = body;

    const saved = await db.$transaction(async (tx) => {
      // Upsert. L'ownership est garanti par createdBy : on ne réattache jamais
      // la facture d'un autre compte, et clientId doit appartenir au même compte.
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id, invoice: { createdBy: user.id } },
      });

      const existing = await tx.invoice.findUnique({
        where: { id },
        select: { createdBy: true },
      });
      if (existing && existing.createdBy !== user.id) {
        throw new Error("FORBIDDEN");
      }

      // Si un client existant est référencé, il doit appartenir au compte connecté.
      let safeClientId: string | null = null;
      if (clientId) {
        const linked = await tx.client.findFirst({
          where: { id: clientId, createdBy: user.id },
          select: { id: true },
        });
        safeClientId = linked?.id ?? null;
      }

      const data: any = {
        clientName: String(clientName || "").trim(),
        clientId: safeClientId,
        status: status || "enCours",
        notes: notes ?? null,
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
  } catch (err: any) {
    if (err?.message === "FORBIDDEN") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    return authErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveClient();
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
