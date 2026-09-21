// GET/POST /api/clients — clients finaux du compte connecté uniquement
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireActiveClient();
    const clients = await db.client.findMany({
      where: { createdBy: user.id },
      orderBy: { name: "asc" },
    });
    return Response.json(clients);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveClient();
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
