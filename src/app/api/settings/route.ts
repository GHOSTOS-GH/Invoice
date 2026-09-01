// GET /api/settings — public-ish (shop info visible to all logged-in users)
// PUT /api/settings — admin only
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth();
    let settings = await db.settings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await db.settings.create({ data: { id: "singleton" } });
    }
    return Response.json(settings);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Only admins can change settings (maintenance mode, shop info, logo)
    await requireRole("admin");
    const body = await req.json();
    const data: any = { updatedAt: new Date() };
    if (typeof body.maintenanceMode === "boolean") data.maintenanceMode = body.maintenanceMode;
    if (typeof body.shopName === "string") data.shopName = body.shopName;
    if (typeof body.shopAddress === "string") data.shopAddress = body.shopAddress;
    if (typeof body.shopPhone === "string") data.shopPhone = body.shopPhone;
    if (typeof body.shopNinea === "string") data.shopNinea = body.shopNinea;
    if (typeof body.footerMessage === "string") data.footerMessage = body.footerMessage;
    if (typeof body.logoUrl === "string") data.logoUrl = body.logoUrl || null;

    const updated = await db.settings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    return Response.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}
