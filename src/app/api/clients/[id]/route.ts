// GET/PUT/DELETE /api/clients/[id] — isolation par createdBy
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
    const client = await db.client.findFirst({
      where: { id, createdBy: user.id },
      include: { invoices: { where: { createdBy: user.id }, orderBy: { createdAt: "desc" } } },
    });
    if (!client) {
      return Response.json({ error: "Client introuvable" }, { status: 404 });
    }
    return Response.json(client);
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
    // Upsert : nécessaire au mode hors ligne (l'id peut être généré localement).
    // On ne peut jamais réattacher un client d'un autre compte (createdBy forcé).
    const existing = await db.client.findFirst({ where: { id, createdBy: user.id } });
    const data = {
      name: body.name?.trim() || existing?.name || "",
      phone: body.phone?.trim() ?? existing?.phone ?? null,
      address: body.address?.trim() ?? existing?.address ?? null,
      updatedAt: new Date(),
    };
    const updated = existing
      ? await db.client.update({ where: { id }, data })
      : await db.client.create({ data: { id, ...data, createdBy: user.id } });
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
    const existing = await db.client.findFirst({ where: { id, createdBy: user.id } });
    if (!existing) {
      return Response.json({ error: "Client introuvable" }, { status: 404 });
    }
    await db.client.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
