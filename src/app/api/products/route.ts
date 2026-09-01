// GET/POST /api/products
// GET: readable by employees+ (for invoice product picker)
// POST: admin only (product catalog management)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role === "client") return Response.json([]);
    const products = await db.product.findMany({
      where: { createdBy: user.id },
      orderBy: { name: "asc" },
    });
    return Response.json(products);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only admins can create products
    const user = await requireRole("admin");
    const { name, category, imageUrl } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Le nom est requis" }, { status: 400 });
    }
    const product = await db.product.create({
      data: {
        name: name.trim(),
        category: category?.trim() || "Divers",
        imageUrl: imageUrl || null,
        createdBy: user.id,
      },
    });
    return Response.json(product);
  } catch (err) {
    return authErrorResponse(err);
  }
}
