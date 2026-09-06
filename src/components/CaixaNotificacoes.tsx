"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notificacao = { id: string; titulo: string; mensagem: string; link: string | null; lida: boolean; created_at: string };

export default function CaixaNotificacoes() {
  const [token, setToken] = useState(""); const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]); const [aberta, setAberta] = useState(false); const [carregando, setCarregando] = useState(false);
  async function carregar(accessToken: string) { setCarregando(true); try { const resposta = await fetch("/api/notificacoes", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }); if (resposta.ok) { const corpo = await resposta.json() as { notificacoes: Notificacao[] }; setNotificacoes(corpo.notificacoes); } } finally { setCarregando(false); } }
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { const atual = data.session?.access_token || ""; setToken(atual); if (atual) void carregar(atual); });
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => { const atual = sessao?.access_token || ""; setToken(atual); if (atual) void carregar(atual); else setNotificacoes([]); });
    const aoFocar = () => { void supabase.auth.getSession().then(({ data: sessao }) => { if (document.visibilityState === "visible" && sessao.session?.access_token) void carregar(sessao.session.access_token); }); };
    document.addEventListener("visibilitychange", aoFocar); return () => { data.subscription.unsubscribe(); document.removeEventListener("visibilitychange", aoFocar); };
  }, []);
  if (!token) return null;
  const naoLidas = notificacoes.filter((item) => !item.lida).length;
  async function abrir(item: Notificacao) { if (!item.lida) { await fetch("/api/notificacoes", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) }); setNotificacoes((atuais) => atuais.map((atual) => atual.id === item.id ? { ...atual, lida: true } : atual)); } if (item.link) window.open(item.link, item.link.startsWith("http") ? "_blank" : "_self", "noopener,noreferrer"); }
  return <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50">
    <button type="button" onClick={() => setAberta((valor) => !valor)} aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`} aria-expanded={aberta} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-950/90 text-xl text-white shadow-xl backdrop-blur">🔔{naoLidas > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-black leading-5 text-white">{naoLidas > 99 ? "99+" : naoLidas}</span>}</button>
    {aberta && <aside className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="font-black">Notificações</h2>{naoLidas > 0 && <button type="button" onClick={async () => { await fetch("/api/notificacoes", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" }); setNotificacoes((atuais) => atuais.map((item) => ({ ...item, lida: true }))); }} className="text-[11px] font-bold text-cyan-300">Marcar todas como lidas</button>}</div><div className="max-h-[60vh] overflow-y-auto p-2">{carregando && notificacoes.length === 0 && <p className="p-4 text-sm text-white/50">Carregando…</p>}{!carregando && notificacoes.length === 0 && <p className="p-4 text-sm text-white/50">Você ainda não recebeu notificações.</p>}{notificacoes.map((item) => <button key={item.id} type="button" onClick={() => void abrir(item)} className={`mb-1 w-full rounded-xl px-3 py-3 text-left ${item.lida ? "bg-white/[0.03]" : "bg-cyan-300/10"}`}><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.lida ? "bg-transparent" : "bg-cyan-300"}`} /><span><strong className="block text-sm">{item.titulo}</strong><span className="mt-1 block text-xs leading-relaxed text-white/60">{item.mensagem}</span><time className="mt-1 block text-[10px] text-white/35">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</time></span></span></button>)}</div></aside>}
  </div>;
}
