"use client";
// Bannière d'installation PWA discrète — apparaît en bas de l'écran si le
// navigateur permet l'installation ; masquée si déjà installée ou si
// l'utilisateur l'a fermée (re-proposée après 7 jours).

import { useEffect, useState } from "react";
import { usePwaInstall } from "@/components/pwa/use-pwa-install";
import { X, Download, Smartphone } from "lucide-react";

const DISMISS_KEY = "pwa_install_dismissed_at";
const DISMISS_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // re-proposer après 7 jours

export function PwaInstallBanner() {
  const { canInstall, promptInstall, isInstalled } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DELAY_MS) return;
    } catch {}
    if (canInstall) setVisible(true);
  }, [canInstall, isInstalled]);

  if (!visible || isInstalled || !canInstall) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900 text-white shadow-2xl shadow-black/25 pl-4 pr-2 py-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Smartphone className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">Installer l'application</p>
          <p className="text-[11px] text-white/60 leading-tight">Accès rapide · fonctionne hors ligne</p>
        </div>
        <button
          onClick={promptInstall}
          className="ml-1 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-2 text-[12px] font-semibold shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Installer
        </button>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
