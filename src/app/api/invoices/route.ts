// GET /api/invoices — list invoices for the current user (RLS-equivalent)
// Employees/admins see all invoices they created; clients see nothing (empty list).
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    // Clients have no access to business data
    if (user.role === "client") {
      return Response.json([]);
    }
    const invoices = await db.invoice.findMany({
      where: { createdBy: user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(invoices);
  } catch (err) {
    return authErrorResponse(err);
  }
}
