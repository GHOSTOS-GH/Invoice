// GET /api/invoices — list shared company invoices.
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
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(invoices);
  } catch (err) {
    return authErrorResponse(err);
  }
}
