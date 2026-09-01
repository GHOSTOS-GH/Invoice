// Server-side auth: password hashing + JWT session management.
// Replaces Supabase Auth in this self-hosted environment.

import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, type UserRole } from "./constants";
import type { SessionUser } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-invoice-secret-change-me-in-prod-please"
);

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashStr: string
): Promise<boolean> {
  return compare(password, hashStr);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.sub as string,
      phone: payload.phone as string,
      role: payload.role as UserRole,
      name: (payload.name as string) || null,
    };
  } catch {
    return null;
  }
}

/** Read the current session from the cookie (server-side, cached per request). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Set the session cookie on login. */
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie on logout. */
export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Fetch the full DB user for a session, applying the DB as source of truth for role/disabled. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.disabled) return null;
  return user;
}

/**
 * RLS-equivalent: returns the session user or throws a 401-shaped error.
 * Used by API routes to guard access.
 */
export async function requireAuth(): Promise<NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Non authentifié", 401);
  }
  return user;
}

/** Require a minimum role level (employee >= client, admin >= employee). */
export async function requireRole(min: UserRole) {
  const user = await requireAuth();
  const order: Record<UserRole, number> = { client: 0, employee: 1, admin: 2 };
  if (order[user.role as UserRole] < order[min]) {
    throw new AuthError("Accès refusé", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Helper to turn an AuthError into a Next.js Response. */
export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("Unexpected auth error:", err);
  return Response.json({ error: "Erreur serveur" }, { status: 500 });
}
