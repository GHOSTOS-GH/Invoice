// GET /api/superadmin/users — tableau de bord plateforme (superadmin uniquement).
// Ne renvoie QUE des métadonnées de compte : jamais de données métier
// (factures/clients/produits) des clients, pour préserver leur confidentialité.
import { db } from "@/lib/db";
import { requireSuperadmin, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperadmin();
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
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
    return Response.json({ users });
  } catch (err) {
    return authErrorResponse(err);
  }
}
