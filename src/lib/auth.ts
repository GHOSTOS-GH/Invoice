// Server-side auth: password hashing + JWT session management.
// Multi-tenant SaaS: two roles only ("superadmin" | "client"), gated access.

import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./constants";
import type { SessionUser, UserRole } from "./types";

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
      // Placeholders — the real values are always re-read from DB (getCurrentUser).
      disabled: false,
      isApproved: false,
      subscriptionStatus: "pending",
      paymentClaimedAt: null,
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

/**
 * Fetch the full DB user for a session. The DB is the single source of truth
 * for role / disabled / isApproved / subscriptionStatus / paymentClaimedAt.
 */
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
export async function requireAuth(): Promise<
  NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Non authentifié", 401);
  }
  return user;
}

/**
 * Business-data guard (API-side, blocks direct API calls):
 * a client account must be approved AND have an active subscription.
 * The superadmin is always allowed through (he has no business data anyway).
 */
export async function requireActiveClient() {
  const user = await requireAuth();
  if (user.role === "superadmin") return user;
  if (!user.isApproved || user.subscriptionStatus !== "active") {
    throw new AuthError("ACCES_NON_AProuVE", 403);
  }
  return user;
}

/** Superadmin-only guard (platform dashboard). */
export async function requireSuperadmin() {
  const user = await requireAuth();
  if (user.role !== "superadmin") {
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
