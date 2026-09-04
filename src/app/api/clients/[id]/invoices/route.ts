import { db } from "@/lib/db";
import { requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("employee");
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
    const [invoices, total] = await db.$transaction([
      db.invoice.findMany({ where: { clientId: id }, skip: (page - 1) * pageSize, take: pageSize, include: { items: true }, orderBy: { createdAt: "desc" } }),
      db.invoice.count({ where: { clientId: id } }),
    ]);
    return Response.json({ invoices, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch (err) {
    return authErrorResponse(err);
  }
}