// PUT/DELETE /api/products/[id] — isolation par createdBy
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveClient();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.product.findFirst({
      where: { id, createdBy: user.id },
    });
    if (!existing) {
      return Response.json({ error: "Produit introuvable" }, { status: 404 });
    }
    const updated = await db.product.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        category: body.category?.trim() ?? existing.category,
        imageUrl: body.imageUrl ?? existing.imageUrl,
        updatedAt: new Date(),
      },
    });
    return Response.json(updated);
  } catch (err) {
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
    const existing = await db.product.findFirst({
      where: { id, createdBy: user.id },
    });
    if (!existing) {
      return Response.json({ error: "Produit introuvable" }, { status: 404 });
    }
    await db.product.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
