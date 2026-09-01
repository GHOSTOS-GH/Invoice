// POST /api/auth/login — phone (+221) + password
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
    const token = await createSessionToken({
      id: user.id,
      phone: user.phone,
      role: user.role as any,
      name: user.name,
    });
    await setSessionCookie(token);
    return Response.json({
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        disabled: user.disabled,
      },
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
