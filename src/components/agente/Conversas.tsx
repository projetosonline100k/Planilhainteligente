"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { adminApi, formatarDataHora, formatarTelefone } from "@/components/agente/api";
import BolhaMensagem from "@/components/agente/BolhaMensagem";
import PainelViagens from "@/components/agente/PainelViagens";
import { Contato, Mensagem, ViagemDesejada } from "@/types/agente";

type Conversa = { contato: Contato; mensagens: Mensagem[]; viagens: ViagemDesejada[] };

export default function Conversas({ contatoInicial }: { contatoInicial: string | null }) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(contatoInicial);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregarContatos = useCallback(async () => {
    try {
      const body = await adminApi<{ contatos: Contato[] }>("/api/admin/agente/painel");
      setContatos(body.contatos);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar contatos.");
    }
  }, []);

  const carregarConversa = useCallback(async (id: string) => {
    try {
      setConversa(await adminApi<Conversa>(`/api/admin/agente/conversa?contato=${id}`));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar conversa.");
    }
  }, []);

  useEffect(() => {
    const primeiro = setTimeout(() => void carregarContatos(), 0);
    const intervalo = setInterval(() => void carregarContatos(), 15_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [carregarContatos]);

  useEffect(() => {
    if (!selecionado) return;
    const primeiro = setTimeout(() => void carregarConversa(selecionado), 0);
    const intervalo = setInterval(() => void carregarConversa(selecionado), 8_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [selecionado, carregarConversa]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [conversa?.mensagens.length]);

  async function acao(payload: Record<string, unknown>) {
    if (!selecionado) return;
    setErro("");
    try {
      setConversa(await adminApi<Conversa>("/api/admin/agente/conversa", { method: "POST", body: JSON.stringify({ contatoId: selecionado, ...payload }) }));
      void carregarContatos();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível completar a ação.");
      void carregarConversa(selecionado);
    }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    await acao({ acao: "enviar", texto });
    setTexto("");
    setEnviando(false);
  }

  const filtrados = contatos.filter((contato) => {
    const termo = busca.trim().toLowerCase();
    return !termo || contato.nome?.toLowerCase().includes(termo) || contato.telefone.includes(termo.replace(/\D/g, "") || termo);
  });
  const contato = conversa?.contato;

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-[560px] lg:grid-cols-[280px_1fr_260px]">
      <aside className={`flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white ${selecionado ? "hidden lg:flex" : "flex"}`}>
        <div className="border-b border-slate-100 p-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtrados.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setSelecionado(item.id)} className={`flex w-full items-start justify-between gap-2 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 ${selecionado === item.id ? "bg-cyan-50" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {item.nome_preferido ?? item.nome ?? formatarTelefone(item.telefone)}
                    {item.simulado && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">teste</span>}
                  </span>
                  <span className="block text-xs text-slate-400">{formatarDataHora(item.ultima_mensagem_em)}</span>
                </span>
                {item.modo === "humano" && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">humano</span>}
                {item.bloqueado && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">bloqueado</span>}
              </button>
            </li>
          ))}
          {filtrados.length === 0 && <li className="p-4 text-center text-sm text-slate-400">Nenhuma conversa ainda.</li>}
        </ul>
      </aside>

      <section className={`flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#efeae2] ${selecionado ? "flex" : "hidden lg:flex"}`}>
        {!contato ? (
          <p className="m-auto px-6 text-center text-sm text-slate-500">Selecione uma conversa para ver as mensagens.</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelecionado(null)} className="text-lg text-slate-500 lg:hidden" aria-label="Voltar">←</button>
                <div>
                  <p className="font-semibold text-slate-900">{contato.nome_preferido ?? contato.nome ?? "Sem nome"}</p>
                  <p className="text-xs text-slate-500">{formatarTelefone(contato.telefone)}{contato.cidade_origem ? ` · sai de ${contato.cidade_origem}${contato.aeroporto_origem ? ` (${contato.aeroporto_origem})` : ""}` : ""} · {contato.total_mensagens} mensagens</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => acao({ acao: "modo", modo: contato.modo === "agente" ? "humano" : "agente" })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${contato.modo === "agente" ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"}`}>
                  {contato.modo === "agente" ? "Assumir conversa" : "Devolver ao agente"}
                </button>
                <button type="button" onClick={() => acao({ acao: "bloqueio", bloqueado: !contato.bloqueado })} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {contato.bloqueado ? "Desbloquear" : "Bloquear"}
                </button>
              </div>
            </header>
            {contato.modo === "humano" && <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">Você está atendendo. O agente não responde até você devolver a conversa.</p>}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {conversa.mensagens.map((mensagem) => <BolhaMensagem key={mensagem.id} mensagem={mensagem} />)}
              <div ref={fimRef} />
            </div>
            {erro && <p className="bg-red-50 px-4 py-2 text-xs text-red-700">{erro}</p>}
            <form onSubmit={enviar} className="flex gap-2 border-t border-slate-200 bg-white p-3">
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={contato.simulado ? "Contato de teste: a mensagem fica só no painel" : "Responder como humano pelo WhatsApp"} className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-cyan-500" />
              <button type="submit" disabled={enviando || !texto.trim()} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300">Enviar</button>
            </form>
          </>
        )}
      </section>

      <aside className={`rounded-2xl border border-slate-200 bg-white p-4 lg:overflow-y-auto ${contato ? "" : "hidden lg:block"}`}>
        <h3 className="text-sm font-bold text-slate-900">Viagens desse contato</h3>
        <div className="mt-3">{conversa ? <PainelViagens viagens={conversa.viagens} /> : <p className="text-sm text-slate-400">—</p>}</div>
      </aside>
    </div>
  );
}
