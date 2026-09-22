"use client";
// Hook d'installation PWA — capture l'événement beforeinstallprompt et expose :
// - canInstall    : le navigateur permet l'installation (critère du prompt)
// - promptInstall : déclenche la boîte de dialogue d'installation native
// - isInstalled   : l'app tourne déjà en standalone (masquer le bouton)
import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Détection : mode standalone (Android/desktop) ou iOS standalone
    const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as any).standalone === true;
    setIsInstalled(standaloneMedia || iosStandalone);

    const onMediaChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", onMediaChange);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      media.removeEventListener?.("change", onMediaChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null && !isInstalled,
    promptInstall,
    isInstalled,
  };
}
