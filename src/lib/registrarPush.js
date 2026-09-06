import { supabase } from "@/lib/supabase";

function converterChaveBase64(chave) {
  const base64 = `${chave}${"=".repeat((4 - chave.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (caractere) => caractere.charCodeAt(0));
}

export function precisaInstalarPWAnoIOS() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return ios && !instalado;
}

export async function notificacoesPushAtivas() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission !== "granted") return false;
  const registro = await navigator.serviceWorker.getRegistration("/");
  return Boolean(await registro?.pushManager.getSubscription());
}

export async function ativarNotificacoesPush() {
  if (precisaInstalarPWAnoIOS()) throw new Error("No iPhone, adicione este app à Tela de Início pra receber notificações.");
  if (!("serviceWorker" in navigator) || (!("PushManager" in window))) throw new Error("Este navegador não oferece notificações push.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error("A chave pública de notificações não está configurada.");

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Permissão para notificações não concedida.");
  const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const existente = await registro.pushManager.getSubscription();
  const subscription = existente || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: converterChaveBase64(publicKey) });
  const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para ativar notificações.");
  const resposta = await fetch("/api/push/subscribe", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
  const corpo = await resposta.json(); if (!resposta.ok) throw new Error(corpo.error || "Não foi possível salvar a inscrição de notificações.");
  return subscription;
}
