"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { adminApi } from "@/components/agente/api";
import BolhaMensagem from "@/components/agente/BolhaMensagem";
import PainelViagens from "@/components/agente/PainelViagens";
import { Mensagem, ViagemDesejada } from "@/types/agente";

type Estado = { mensagens: Mensagem[]; viagens: ViagemDesejada[]; pendente?: boolean; erro?: string | null; motivo?: string | null };

const SUGESTOES = [
  "Oi! Quero muito conhecer Lisboa",
  "Quero ir pra Recife em julho do ano que vem, deve custar uns 4 mil",
  "Guardei 500 reais pra viagem de Recife",
  "Tô longe ou perto de conseguir ir?",
  "Tem passagem barata saindo de São Paulo?",
  "Preciso de passaporte pra ir pro Chile?",
];

export default function Simulador() {
  const [estado, setEstado] = useState<Estado>({ mensagens: [], viagens: [] });
  const [texto, setTexto] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi<Estado>("/api/admin/agente/simular").then(setEstado).catch((error: Error) => setErro(error.message));
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [estado.mensagens.length, pendente]);

  useEffect(() => {
    if (!estado.pendente) return;
    const intervalo = setInterval(() => {
      adminApi<Estado>("/api/admin/agente/simular").then(setEstado).catch(() => {});
    }, 2_000);
    return () => clearInterval(intervalo);
  }, [estado.pendente]);

  async function enviar(mensagem: string) {
    if (!mensagem.trim() || pendente || estado.pendente) return;
    setPendente(mensagem);
    setTexto("");
    setErro("");
    try {
      const body = await adminApi<Estado>("/api/admin/agente/simular", { method: "POST", body: JSON.stringify({ texto: mensagem }) });
      setEstado(body);
      if (body.erro) setErro(body.erro);
      else if (body.motivo) setErro(body.motivo);
      else if (body.pendente) setErro("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao simular.");
    } finally {
      setPendente(null);
    }
  }

  async function reiniciar() {
    if (!window.confirm("Apagar a conversa e as viagens do simulador?")) return;
    setEstado(await adminApi<Estado>("/api/admin/agente/simular", { method: "DELETE" }));
    setErro("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void enviar(texto);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-[#efeae2] shadow-2xl shadow-black/40">
        <header className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">✈️</span>
            <div><p className="text-sm font-semibold">Agente VaiViajar</p><p className="text-[11px] text-white/70">{pendente || estado.pendente ? "digitando…" : "simulação"}</p></div>
          </div>
          <button type="button" onClick={reiniciar} className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold hover:bg-white/25">Reiniciar</button>
        </header>
        <div className="h-[min(60dvh,520px)] space-y-3 overflow-y-auto p-3">
          {estado.mensagens.length === 0 && !pendente && (
            <p className="mx-auto mt-8 max-w-[80%] rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-xs text-slate-700">
              Converse aqui como se fosse um cliente. Usa o mesmo cérebro, prompt e ferramentas do WhatsApp real, mas nada é enviado para ninguém.
            </p>
          )}
          {estado.mensagens.map((mensagem) => <BolhaMensagem key={mensagem.id} mensagem={mensagem} />)}
          {estado.pendente && !pendente && (
            <div className="flex justify-end"><div className="rounded-2xl bg-[#d9fdd3] px-4 py-2 text-sm text-slate-500">Claude pensando…</div></div>
          )}
          {pendente && (
            <>
              <div className="flex justify-start"><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm">{pendente}</div></div>
              <div className="flex justify-end"><div className="rounded-2xl bg-[#d9fdd3] px-4 py-2 text-sm text-slate-500">…</div></div>
            </>
          )}
          <div ref={fimRef} />
        </div>
        {erro && <p className="bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
        <form onSubmit={onSubmit} className="flex gap-2 bg-[#f0f0f0] p-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none" />
          <button type="submit" disabled={!texto.trim() || Boolean(pendente) || Boolean(estado.pendente)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white disabled:bg-slate-300" aria-label="Enviar">➤</button>
        </form>
      </div>

      <div className="space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-slate-900">Testes rápidos</h3>
          <p className="mt-1 text-xs text-slate-500">Clique para mandar como cliente.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGESTOES.map((sugestao) => (
              <button key={sugestao} type="button" onClick={() => enviar(sugestao)} disabled={Boolean(pendente)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 disabled:opacity-50">{sugestao}</button>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-slate-900">O que o agente salvou</h3>
          <p className="mt-1 text-xs text-slate-500">Dados que ele gravou no banco durante a conversa.</p>
          <div className="mt-3"><PainelViagens viagens={estado.viagens} /></div>
        </article>
      </div>
    </div>
  );
}
