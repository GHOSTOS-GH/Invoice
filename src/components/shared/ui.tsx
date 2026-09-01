"use client";
// Shared presentational components used across screens.

import { cn } from "@/lib/utils";
import { INVOICE_STATUS_META, type InvoiceStatus } from "@/lib/constants";
import type { ReactNode } from "react";

export function StatusBadge({
  status,
  size = "md",
}: {
  status: InvoiceStatus;
  size?: "sm" | "md";
}) {
  const meta = INVOICE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full",
        meta.bg,
        meta.text,
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      )}
    >
      <span className={cn("rounded-full", meta.dot, size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")} />
      {meta.label}
    </span>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: any;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="px-4 sm:px-6 py-3.5 flex items-center gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#2563EB]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] sm:text-lg font-bold text-slate-900 leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] text-slate-400 leading-tight truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-[16px] font-bold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-[13px] text-slate-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ message = "Chargement…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-[#2563EB] animate-spin" />
      <p className="text-[13px] text-slate-400 mt-3">{message}</p>
    </div>
  );
}

export function InvoiceCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3"
        >
          <div className="w-1 h-12 rounded-full bg-slate-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-56 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-5 w-24 rounded bg-slate-200 animate-pulse ml-auto" />
            <div className="h-3 w-16 rounded bg-slate-100 animate-pulse ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  children,
  action,
  className,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
