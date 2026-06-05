"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;

  const navigatorStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return window.matchMedia("(display-mode: standalone)").matches || navigatorStandalone;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (estaInstalado()) return;

    const dispensado = sessionStorage.getItem("pwa-install-dismissed-session") === "1";
    if (dispensado) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisivel(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleFecharSemPersistir);

    const timer = window.setTimeout(() => {
      setMostrarIOS(isIOS());
      setVisivel(true);
    }, 900);

    function handleFecharSemPersistir() {
      setInstallPrompt(null);
      setVisivel(false);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleFecharSemPersistir);
    };
  }, []);

  async function handleInstalar() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setVisivel(false);
    }

    setInstallPrompt(null);
  }

  function handleFechar() {
    sessionStorage.setItem("pwa-install-dismissed-session", "1");
    setVisivel(false);
  }

  if (!visivel) return null;

  const textoAjuda = mostrarIOS
    ? "No iPhone, toque em Compartilhar e depois em Adicionar a Tela de Inicio."
    : installPrompt
      ? "Instale na tela inicial para abrir em modo app."
      : isAndroid()
        ? "No Chrome, abra o menu de tres pontos e toque em Instalar app."
        : "No Chrome ou Edge, use o icone de instalacao na barra de endereco ou o menu do navegador.";

  return (
    <div className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-sm rounded-xl border border-blue-100 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Image
          src="/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Usar como app</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{textoAjuda}</p>
        </div>
        <button
          type="button"
          onClick={handleFechar}
          className="shrink-0 text-lg leading-none text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          x
        </button>
      </div>

      {installPrompt && (
        <button
          type="button"
          onClick={handleInstalar}
          className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Instalar app
        </button>
      )}
    </div>
  );
}
