// PUT /api/users/[id]/disable — admin only: enable/disable a user account
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("admin");
    const { id } = await params;
    const { disabled } = await req.json();
    if (typeof disabled !== "boolean") {
      return Response.json({ error: "Paramètre 'disabled' requis" }, { status: 400 });
    }
    if (id === admin.id && disabled) {
      return Response.json(
        { error: "Vous ne pouvez pas désactiver votre propre compte" },
        { status: 400 }
      );
    }
    const updated = await db.user.update({
      where: { id },
      data: { disabled },
      select: { id: true, phone: true, role: true, name: true, disabled: true },
    });
    return Response.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}
