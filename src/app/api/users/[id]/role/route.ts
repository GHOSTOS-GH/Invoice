// PUT /api/users/[id]/role — admin only: change a user's role
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole, authErrorResponse } from "@/lib/auth";
import type { UserRole } from "@/lib/constants";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("admin");
    const { id } = await params;
    const { role } = await req.json();
    if (!["client", "employee", "admin"].includes(role)) {
      return Response.json({ error: "Rôle invalide" }, { status: 400 });
    }
    if (id === admin.id && role !== "admin") {
      return Response.json(
        { error: "Vous ne pouvez pas rétrograder votre propre compte" },
        { status: 400 }
      );
    }
    const updated = await db.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: { id: true, phone: true, role: true, name: true, disabled: true },
    });
    return Response.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}
