// GET/PUT/DELETE /api/clients/[id]
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
    const client = await db.client.findUnique({
      where: { id },
      include: { invoices: { orderBy: { createdAt: "desc" } } },
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
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Client introuvable" }, { status: 404 });
    }
    const updated = await db.client.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        phone: body.phone?.trim() ?? existing.phone,
        address: body.address?.trim() ?? existing.address,
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
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Client introuvable" }, { status: 404 });
    }
    await db.client.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
