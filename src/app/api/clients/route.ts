// GET/POST /api/clients
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role === "client") return Response.json([]);
    const clients = await db.client.findMany({ orderBy: { name: "asc" } });
    return Response.json(clients);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const { name, phone, address } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Le nom est requis" }, { status: 400 });
    }
    const client = await db.client.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        createdBy: user.id,
      },
    });
    return Response.json(client);
  } catch (err) {
    return authErrorResponse(err);
  }
}
