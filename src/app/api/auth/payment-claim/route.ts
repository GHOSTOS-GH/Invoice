// POST /api/auth/payment-claim — le client déclare avoir effectué le paiement
// (virement, Wave, Orange Money… géré en dehors de l'app). Horodate le clic
// pour que le superadmin voie « Paiement signalé le … » dans son tableau de bord.
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    // Idempotent : on conserve le premier signalement.
    const updated = await db.user.update({
      where: { id: user.id },
      data: { paymentClaimedAt: user.paymentClaimedAt ?? new Date() },
      select: { id: true, paymentClaimedAt: true },
    });
    return Response.json({
      ok: true,
      paymentClaimedAt: updated.paymentClaimedAt,
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
