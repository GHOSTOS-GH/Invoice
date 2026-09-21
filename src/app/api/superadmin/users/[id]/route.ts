// PUT /api/superadmin/users/[id] — actions rapides du tableau de bord plateforme.
// Body: { action: "approve" | "suspend" | "activate" | "disable" | "enable" | "reset" }
// - approve  : isApproved=true + subscriptionStatus="active" → débloque l'accès
// - suspend  : subscriptionStatus="suspended" (compte approuvé conservé)
// - activate : subscriptionStatus="active"
// - disable  : disabled=true (compte bloqué)
// - enable   : disabled=false
// - reset    : repasse en attente (isApproved=false, subscriptionStatus="pending",
//              efface le signalement de paiement)
// Le superadmin ne peut jamais modifier son propre compte ni un autre superadmin.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperadmin();
    const { id } = await params;
    const { action } = await req.json();
    if (typeof action !== "string") {
      return Response.json({ error: "Action requise" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return Response.json({ error: "Compte introuvable" }, { status: 404 });
    }
    if (target.role === "superadmin") {
      return Response.json(
        { error: "Impossible de modifier un compte superadmin" },
        { status: 403 }
      );
    }

    const data: any = {};
    switch (action) {
      case "approve":
        data.isApproved = true;
        data.subscriptionStatus = "active";
        break;
      case "suspend":
        data.subscriptionStatus = "suspended";
        break;
      case "activate":
        data.subscriptionStatus = "active";
        break;
      case "disable":
        data.disabled = true;
        break;
      case "enable":
        data.disabled = false;
        break;
      case "reset":
        data.isApproved = false;
        data.subscriptionStatus = "pending";
        data.paymentClaimedAt = null;
        break;
      default:
        return Response.json({ error: "Action inconnue" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        phone: true,
        role: true,
        name: true,
        disabled: true,
        isApproved: true,
        subscriptionStatus: true,
        paymentClaimedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Response.json({ user: updated });
  } catch (err) {
    return authErrorResponse(err);
  }
}
