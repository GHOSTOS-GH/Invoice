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
    // Upsert : nécessaire au mode hors ligne (l'id peut être généré localement).
    // On ne peut jamais réattacher un produit d'un autre compte (createdBy forcé).
    const existing = await db.product.findFirst({
      where: { id, createdBy: user.id },
    });
    const data = {
      name: body.name?.trim() || existing?.name || "",
      category: body.category?.trim() || existing?.category || "Divers",
      imageUrl: body.imageUrl ?? existing?.imageUrl ?? null,
      updatedAt: new Date(),
    };
    const updated = existing
      ? await db.product.update({ where: { id }, data })
      : await db.product.create({ data: { id, ...data, createdBy: user.id } });
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
