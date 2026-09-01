"use client";
// Users management screen (admin only) — reproduces the users section of
// settings: list users, change role, enable/disable, self-protection.
// Role badges: admin #2563EB, employee #16A34A, client #9E9E9E.

import { useState, useMemo } from "react";
import {
  useUsers,
  updateUserRole,
  updateUserDisabled,
} from "@/lib/data-hooks";
import { useAuth } from "@/lib/auth-context";
import {
  ScreenHeader,
  EmptyState,
  LoadingState,
} from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  Phone,
  Ban,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLE_META, type UserRole } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatters";
import type { User } from "@/lib/types";

const ROLE_ORDER: UserRole[] = ["admin", "employee", "client"];

type RoleFilter = "all" | UserRole;

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "admin", label: "Admins" },
  { value: "employee", label: "Employés" },
  { value: "client", label: "Clients" },
];

export function UsersScreen() {
  const { users, loading, refresh } = useUsers();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const typedUsers = users as User[];

  const counts = useMemo(() => {
    const c = { all: typedUsers.length, admin: 0, employee: 0, client: 0 };
    for (const u of typedUsers) c[u.role]++;
    return c;
  }, [typedUsers]);

  const filtered = useMemo(() => {
    let list = typedUsers;
    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q)
      );
    }
    // Sort by role rank then createdAt desc.
    return [...list].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role);
      const rb = ROLE_ORDER.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [typedUsers, search, roleFilter]);

  const onChangeRole = async (u: User, role: UserRole) => {
    if (role === u.role) return;
    try {
      await updateUserRole(u.id, role);
      toast.success(
        `${u.name || u.phone} est maintenant « ${ROLE_META[role].label} »`
      );
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erreur";
      toast.error("Échec du changement de rôle: " + msg);
    }
  };

  const onToggleDisabled = async (u: User, disabled: boolean) => {
    if (disabled === u.disabled) return;
    try {
      await updateUserDisabled(u.id, disabled);
      toast.success(
        disabled
          ? `${u.name || u.phone} désactivé`
          : `${u.name || u.phone} réactivé`
      );
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erreur";
      toast.error("Échec: " + msg);
    }
  };

  return (
    <div>
      <ScreenHeader
        title="Comptes utilisateurs"
        subtitle={`${users.length} compte${users.length > 1 ? "s" : ""} · ${
          counts.admin
        } admin · ${counts.employee} employé${
          counts.employee > 1 ? "s" : ""
        } · ${counts.client} client${counts.client > 1 ? "s" : ""}`}
        icon={Users}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="rounded-xl h-9 px-3"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            className="h-10 rounded-xl pl-9 border-slate-200"
          />
        </div>

        {/* Role filter chips */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = roleFilter === f.value;
            const count = counts[f.value as keyof typeof counts];
            return (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all",
                  active
                    ? "bg-[#2563EB] text-white border-transparent shadow-sm shadow-blue-500/20"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={users.length === 0 ? "Aucun compte" : "Aucun résultat"}
            description={
              users.length === 0
                ? "Aucun compte utilisateur enregistré pour le moment."
                : "Ajustez votre recherche ou vos filtres."
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={!!me && me.id === u.id}
                onChangeRole={(r) => onChangeRole(u, r)}
                onToggleDisabled={(d) => onToggleDisabled(u, d)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
      style={{ backgroundColor: meta.color }}
    >
      <ShieldCheck className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function UserRow({
  user,
  isSelf,
  onChangeRole,
  onToggleDisabled,
}: {
  user: User;
  isSelf: boolean;
  onChangeRole: (role: UserRole) => void;
  onToggleDisabled: (disabled: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-3.5 sm:p-4 transition-all",
        user.disabled
          ? "border-slate-200 opacity-70"
          : "border-slate-200/80 hover:shadow-md hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[14px] uppercase"
          style={{ backgroundColor: ROLE_META[user.role].color }}
          aria-hidden
        >
          {(user.name || user.phone).slice(0, 1)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900 text-[15px] truncate">
                  {user.name || "Sans nom"}
                </p>
                {isSelf && (
                  <span className="text-[10px] font-bold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded-full">
                    Vous
                  </span>
                )}
                {user.disabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    <Ban className="w-3 h-3" /> Désactivé
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[12px] text-slate-400 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span className="font-mono">{user.phone}</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Inscrit le {formatDateTime(user.createdAt)}
                </span>
              </div>
            </div>

            <RoleBadge role={user.role} />
          </div>

          {/* Controls */}
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2">
              <label
                className="text-[11px] font-medium text-slate-400"
                id={`role-label-${user.id}`}
              >
                Rôle
              </label>
              <Select
                value={user.role}
                onValueChange={(v) => onChangeRole(v as UserRole)}
                disabled={isSelf}
              >
                <SelectTrigger
                  aria-labelledby={`role-label-${user.id}`}
                  className={cn(
                    "h-8 w-[160px] rounded-xl text-[12px] font-semibold",
                    isSelf && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => (
                    <SelectItem key={r} value={r} className="text-[13px]">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: ROLE_META[r].color }}
                        />
                        {ROLE_META[r].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label
                className="text-[11px] font-medium text-slate-400"
                id={`active-label-${user.id}`}
              >
                Activé
              </label>
              <Switch
                aria-labelledby={`active-label-${user.id}`}
                checked={!user.disabled}
                disabled={isSelf}
                onCheckedChange={(checked) => onToggleDisabled(!checked)}
              />
              {isSelf && (
                <span className="text-[10px] text-slate-400 italic">
                  auto-protection
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
