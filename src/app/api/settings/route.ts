// GET /api/settings — réglages de la boutique du compte connecté (auto-créés)
// PUT /api/settings — mise à jour par le propriétaire uniquement
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireActiveClient, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireActiveClient();
    // Une boutique = ses propres réglages. Le superadmin obtient un jeu vide.
    let settings = await db.settings.findUnique({
      where: { userId: user.id },
    });
    if (!settings && user.role === "client") {
      settings = await db.settings.create({
        data: { userId: user.id, shopName: "" },
      });
    }
    return Response.json(settings ?? { userId: user.id, shopName: "", shopAddress: "", shopPhone: "", shopNinea: "", footerMessage: "Merci de votre visite !", logoUrl: null });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireActiveClient();
    if (user.role !== "client") {
      return Response.json(
        { error: "Seuls les comptes clients ont des réglages boutique" },
        { status: 403 }
      );
    }
    const body = await req.json();
    const data: any = { updatedAt: new Date() };
    if (typeof body.shopName === "string") data.shopName = body.shopName;
    if (typeof body.shopAddress === "string") data.shopAddress = body.shopAddress;
    if (typeof body.shopPhone === "string") data.shopPhone = body.shopPhone;
    if (typeof body.shopNinea === "string") data.shopNinea = body.shopNinea;
    if (typeof body.footerMessage === "string") data.footerMessage = body.footerMessage;
    if (typeof body.logoUrl === "string") data.logoUrl = body.logoUrl || null;

    const updated = await db.settings.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return Response.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}
