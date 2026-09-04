// GET /api/invoices — list shared company invoices.
import { db } from "@/lib/db";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    // Clients have no access to business data
    if (user.role === "client") {
      return Response.json([]);
    }
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 30)));
    const [invoices, total] = await db.$transaction([
      db.invoice.findMany({
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      db.invoice.count(),
    ]);
    return Response.json({
      invoices,
      pagination: { page, pageSize: all ? total : pageSize, total, hasMore: all ? false : page * pageSize < total },
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
