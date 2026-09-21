// GET /api/invoices — liste paginée des factures DU compte connecté uniquement
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireActiveClient();
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 30)));
    // Isolation multi-tenant stricte : uniquement les factures créées par ce compte.
    const where = { createdBy: user.id };
    const [invoices, total] = await db.$transaction([
      db.invoice.findMany({
        where,
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      db.invoice.count({ where }),
    ]);
    return Response.json({
      invoices,
      pagination: { page, pageSize: all ? total : pageSize, total, hasMore: all ? false : page * pageSize < total },
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
