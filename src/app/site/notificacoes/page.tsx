"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notificacao = { id: string; titulo: string; mensagem: string; link: string | null; lida: boolean; created_at: string };
type Filtro = "todas" | "nao-lidas";

export default function SiteNotificacoes() {
  const [token, setToken] = useState("");
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semSessao, setSemSessao] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  async function carregar(accessToken: string) {
    setCarregando(true);
    try {
      const resposta = await fetch("/api/notificacoes", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (resposta.ok) {
        const corpo = (await resposta.json()) as { notificacoes: Notificacao[] };
        setNotificacoes(corpo.notificacoes);
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setSemSessao(true);
        setCarregando(false);
        return;
      }
      setToken(accessToken);
      void carregar(accessToken);
    });
  }, []);

  async function marcarLida(item: Notificacao) {
    if (item.lida) return;
    await fetch("/api/notificacoes", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    setNotificacoes((atuais) => atuais.map((atual) => (atual.id === item.id ? { ...atual, lida: true } : atual)));
  }

  async function marcarTodasLidas() {
    await fetch("/api/notificacoes", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" });
    setNotificacoes((atuais) => atuais.map((item) => ({ ...item, lida: true })));
  }

  const naoLidas = notificacoes.filter((item) => !item.lida).length;
  const listadas = filtro === "nao-lidas" ? notificacoes.filter((item) => !item.lida) : notificacoes;

  return (
    <div className="px-5 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-600">Notificações</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Fique por dentro das melhores oportunidades</h1>
        </div>
        {naoLidas > 0 && (
          <button type="button" onClick={() => void marcarTodasLidas()} className="rounded-full border border-blue-200 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {semSessao && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Entre na sua conta para ver suas notificações.
          <Link href="/login" className="ml-2 font-black text-blue-700 hover:underline">Entrar</Link>
        </div>
      )}

      {!semSessao && (
        <>
          <div className="mt-4 flex gap-2">
            {([
              ["todas", "Todas"],
              ["nao-lidas", `Não lidas${naoLidas > 0 ? ` (${naoLidas})` : ""}`],
            ] as [Filtro, string][]).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${filtro === valor ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            {carregando && <p className="text-sm font-semibold text-slate-500">Carregando...</p>}
            {!carregando && listadas.length === 0 && <p className="text-sm font-semibold text-slate-500">Nenhuma notificação por aqui.</p>}
            {listadas.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void marcarLida(item)}
                className={`block w-full rounded-2xl border p-4 text-left transition-colors ${item.lida ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.lida ? "bg-transparent" : "bg-blue-500"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{item.titulo}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.mensagem}</p>
                    <time className="mt-1 block text-xs text-slate-400">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}
                    </time>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
