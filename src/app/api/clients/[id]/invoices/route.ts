// GET /api/clients/[id]/invoices — historique paginé, isolation par createdBy
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveClient();
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
    // Le client final doit appartenir au compte connecté pour voir son historique.
    const where = { clientId: id, createdBy: user.id };
    const [invoices, total] = await db.$transaction([
      db.invoice.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, include: { items: true }, orderBy: { createdAt: "desc" } }),
      db.invoice.count({ where }),
    ]);
    return Response.json({ invoices, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch (err) {
    return authErrorResponse(err);
  }
}