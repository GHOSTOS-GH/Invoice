// POST /api/auth/login — phone (+221) + password.
// La connexion réussit même si le compte n'est pas encore approuvé :
// c'est l'écran d'attente (côté client) et le garde API côté serveur
// qui bloquent l'accès aux données métier.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  authErrorResponse,
} from "@/lib/auth";
import { normalizeSenegalPhone } from "@/lib/formatters";

export const runtime = "nodejs";

function publicUser(u: any) {
  return {
    id: u.id,
    phone: u.phone,
    role: u.role,
    name: u.name,
    disabled: u.disabled,
    isApproved: u.isApproved,
    subscriptionStatus: u.subscriptionStatus,
    paymentClaimedAt: u.paymentClaimedAt,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return Response.json({ error: "Téléphone et mot de passe requis" }, { status: 400 });
    }
    const normalized = normalizeSenegalPhone(phone);
    const user = await db.user.findUnique({ where: { phone: normalized } });
    if (!user) {
      return Response.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    if (user.disabled) {
      return Response.json({ error: "Ce compte est désactivé" }, { status: 403 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return Response.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const token = await createSessionToken(publicUser(user) as any);
    await setSessionCookie(token);
    return Response.json({ user: publicUser(user) });
  } catch (err) {
    return authErrorResponse(err);
  }
}
