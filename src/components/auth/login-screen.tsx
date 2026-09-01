"use client";
// Login + Register screen — reproduces login_screen.dart visual identity
// (blue gradient, white rounded card, gradient icon badge).

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Lock,
  Phone,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { isValidSenegalPhone, normalizeSenegalPhone } from "@/lib/formatters";

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    if (!isValidSenegalPhone(normalizeSenegalPhone(phone))) {
      setError("Numéro sénégalais invalide (format +221XXXXXXXXX)");
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizeSenegalPhone(phone);
      if (mode === "login") {
        await login({ phone: normalized, password });
      } else {
        await register({ phone: normalized, password, name });
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #2563EB 0%, #1D4ED8 55%, #1E3A8A 100%)",
        }}
      />
      {/* Decorative blurred blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-blue-400/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-[28px] shadow-2xl shadow-black/25 p-7 sm:p-9">
          {/* Icon badge */}
          <div className="flex justify-center mb-5">
            <div
              className="w-20 h-20 rounded-[22px] flex items-center justify-center shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
                boxShadow: "0 8px 18px rgba(37,99,235,0.35)",
              }}
            >
              <ShieldCheck className="w-11 h-11 text-white" strokeWidth={2} />
            </div>
          </div>

          <h1 className="text-center text-[23px] font-extrabold text-slate-900 tracking-tight">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="text-center text-sm text-slate-500 mt-1.5 mb-7">
            {mode === "login"
              ? "Facturier Konté — Accédez à votre espace"
              : "Nouveau compte (rôle client par défaut)"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-700 font-medium">
                  Nom (optionnel)
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-700 font-medium">
                Téléphone (+221)
              </Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  inputMode="tel"
                  className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-[14px] text-[15px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" /> Se connecter
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" /> S'inscrire
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "login" ? "register" : "login"));
                setError(null);
              }}
              className="text-[13px] font-medium text-[#2563EB] hover:underline"
            >
              {mode === "login"
                ? "Pas encore de compte ? S'inscrire"
                : "Déjà un compte ? Se connecter"}
            </button>
          </div>

          {/* Demo credentials hint */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-[12px] text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-600 mb-1">Comptes de démonstration :</p>
            <p>Admin : <span className="font-mono text-slate-700">+221770000000</span> / <span className="font-mono text-slate-700">admin1234</span></p>
            <p>Employé : <span className="font-mono text-slate-700">+221771111111</span> / <span className="font-mono text-slate-700">employe1234</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
