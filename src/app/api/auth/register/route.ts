// POST /api/auth/register — open signup, default role "client"
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
  authErrorResponse,
} from "@/lib/auth";
import {
  isValidSenegalPhone,
  normalizeSenegalPhone,
} from "@/lib/formatters";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { phone, password, name } = await req.json();
    if (!phone || !password) {
      return Response.json(
        { error: "Téléphone et mot de passe requis" },
        { status: 400 }
      );
    }
    const normalized = normalizeSenegalPhone(phone);
    if (!isValidSenegalPhone(normalized)) {
      return Response.json(
        { error: "Numéro sénégalais invalide (+221XXXXXXXXX)" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return Response.json(
        { error: "Le mot de passe doit faire au moins 4 caractères" },
        { status: 400 }
      );
    }
    const existing = await db.user.findUnique({
      where: { phone: normalized },
    });
    if (existing) {
      return Response.json(
        { error: "Ce numéro est déjà enregistré" },
        { status: 409 }
      );
    }
    // New accounts are ALWAYS "client" — no way to self-promote.
    const user = await db.user.create({
      data: {
        phone: normalized,
        passwordHash: await hashPassword(password),
        name: name?.trim() || null,
        role: "client",
      },
    });
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
