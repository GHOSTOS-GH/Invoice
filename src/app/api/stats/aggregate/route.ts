import { db } from "@/lib/db";
import { requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

type Period = "day" | "week" | "month" | "all";

function periodStart(period: Period) {
  if (period === "all") return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "day") return start;
  start.setDate(start.getDate() - (period === "week" ? 6 : 29));
  return start;
}

export async function GET(req: Request) {
  try {
    await requireRole("employee");
    const rawPeriod = new URL(req.url).searchParams.get("period") as Period | null;
    const period: Period = rawPeriod && ["day", "week", "month", "all"].includes(rawPeriod)
      ? rawPeriod
      : "week";
    const start = periodStart(period);
    const dateFilter = start ? `AND i."createdAt" >= ${start}` : undefined;

    const [summary, statusCounts, topClients, topProducts, series] = await Promise.all([
      db.$queryRawUnsafe<Array<{ total_ca: number | null; invoice_count: bigint; article_count: bigint; average: number | null; largest: number | null }>>(`
        SELECT COALESCE(SUM(ii.quantity * ii."unitPrice"), 0) AS total_ca,
          COUNT(DISTINCT i.id) AS invoice_count,
          COALESCE(SUM(ii.quantity), 0) AS article_count,
          COALESCE(SUM(ii.quantity * ii."unitPrice"), 0) / NULLIF(COUNT(DISTINCT i.id), 0) AS average,
          COALESCE(MAX(t.total), 0) AS largest
        FROM "Invoice" i
        LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
        LEFT JOIN (
          SELECT i2.id, SUM(ii2.quantity * ii2."unitPrice") AS total
          FROM "Invoice" i2 JOIN "InvoiceItem" ii2 ON ii2."invoiceId" = i2.id
          WHERE i2.status IN ('enLivraison', 'livree') ${start ? `AND i2."createdAt" >= $1` : ""}
          GROUP BY i2.id
        ) t ON t.id = i.id
        WHERE i.status IN ('enLivraison', 'livree') ${start ? `AND i."createdAt" >= $1` : ""}
      `, ...(start ? [start] : [])),
      db.$queryRawUnsafe<Array<{ status: string; count: bigint; total: number }>>(`
        SELECT i.status, COUNT(DISTINCT i.id) AS count,
          COALESCE(SUM(ii.quantity * ii."unitPrice"), 0) AS total
        FROM "Invoice" i LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
        WHERE 1=1 ${start ? `AND i."createdAt" >= $1` : ""}
        GROUP BY i.status
      `, ...(start ? [start] : [])),
      db.$queryRawUnsafe<Array<{ name: string; value: number }>>(`
        SELECT i."clientName" AS name, SUM(ii.quantity * ii."unitPrice") AS value
        FROM "Invoice" i JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
        WHERE i.status IN ('enLivraison', 'livree') ${start ? `AND i."createdAt" >= $1` : ""}
        GROUP BY i."clientName" ORDER BY value DESC LIMIT 5
      `, ...(start ? [start] : [])),
      db.$queryRawUnsafe<Array<{ name: string; value: bigint }>>(`
        SELECT ii.name, SUM(ii.quantity) AS value
        FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
        WHERE i.status IN ('enLivraison', 'livree') ${start ? `AND i."createdAt" >= $1` : ""}
        GROUP BY ii.name ORDER BY value DESC LIMIT 5
      `, ...(start ? [start] : [])),
      db.$queryRawUnsafe<Array<{ label: string; value: number }>>(`
        SELECT TO_CHAR(DATE_TRUNC('${period === "all" ? "month" : "day"}', i."createdAt"), '${period === "all" ? "YYYY-MM" : "YYYY-MM-DD"}') AS label,
          COALESCE(SUM(ii.quantity * ii."unitPrice"), 0) AS value
        FROM "Invoice" i JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
        WHERE i.status IN ('enLivraison', 'livree') ${start ? `AND i."createdAt" >= $1` : ""}
        GROUP BY 1 ORDER BY 1
      `, ...(start ? [start] : [])),
    ]);

    const row = summary[0] ?? { total_ca: 0, invoice_count: BigInt(0), article_count: BigInt(0), average: 0, largest: 0 };
    return Response.json({
      period,
      totalCA: Number(row.total_ca ?? 0),
      factureCount: Number(row.invoice_count),
      articlesVendus: Number(row.article_count),
      panierMoyen: Number(row.average ?? 0),
      plusGrosse: Number(row.largest ?? 0),
      statusRep: statusCounts.map((item) => ({ status: item.status, count: Number(item.count), total: Number(item.total) })),
      topClients: topClients.map((item) => ({ name: item.name, value: Number(item.value) })),
      topProducts: topProducts.map((item) => ({ name: item.name, value: Number(item.value) })),
      caSeries: series.map((item) => ({ label: item.label, value: Number(item.value) })),
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}