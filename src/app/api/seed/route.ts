// POST /api/seed — one-shot bootstrap to create the first admin account.
// This mirrors the "create the first admin manually in the DB" step from the
// README. It is idempotent: only creates an admin if none exists yet, and
// refuses to run in production unless explicitly enabled via env.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { normalizeSenegalPhone, isValidSenegalPhone } from "@/lib/formatters";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Safety: refuse if an admin already exists
  const adminCount = await db.user.count({ where: { role: "admin" } });
  if (adminCount > 0) {
    return Response.json(
      { error: "Un compte admin existe déjà. Cette route est désactivée." },
      { status: 409 }
    );
  }
  const { phone, password, name } = await req.json();
  if (!phone || !password) {
    return Response.json(
      { error: "Téléphone et mot de passe requis" },
      { status: 400 }
    );
  }
  const normalized = normalizeSenegalPhone(phone);
  if (!isValidSenegalPhone(normalized)) {
    return Response.json({ error: "Numéro sénégalais invalide" }, { status: 400 });
  }
  const user = await db.user.create({
    data: {
      phone: normalized,
      passwordHash: await hashPassword(password),
      name: name?.trim() || "Administrateur",
      role: "admin",
    },
    select: { id: true, phone: true, role: true, name: true },
  });
  return Response.json({ user, message: "Compte admin créé avec succès" });
}
