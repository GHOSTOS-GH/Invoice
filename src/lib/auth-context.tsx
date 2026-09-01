// Frontend auth context: tracks the current user, login/register/logout,
// and exposes a simple `apiFetch` that carries the session cookie.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser, LoginPayload, RegisterPayload } from "./types";

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (p: LoginPayload) => Promise<void>;
  register: (p: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (p: LoginPayload) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connexion échouée");
      setUser(data.user);
    },
    []
  );

  const register = useCallback(async (p: RegisterPayload) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Inscription échouée");
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
