"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Modo = "assistente" | "pesquisa";
type Mensagem = { id: number; papel: "assistente" | "usuario"; texto: string };
type Estimativa = {
  valorEstimado: number;
  faixaMinima: number;
  faixaMaxima: number;
  confianca: "baixa" | "media" | "alta";
  observacao: string;
};

const mensagemInicial: Mensagem = {
  id: 1,
  papel: "assistente",
  texto: "Olá, viajante! ✈️ Para onde você quer ir?",
};

function formatarData(iso: string): string {
  if (!iso) return "Adicionar";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TextoDaMensagem({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s<]+)/g);

  return partes.map((parte, indice) => {
    if (!parte.startsWith("http")) return parte;

    const url = parte.replace(/[),.;!?]+$/, "");
    const sufixo = parte.slice(url.length);
    return (
      <span key={`${url}-${indice}`}>
        <a href={url} target="_blank" rel="noreferrer" className="break-all text-cyan-200 underline decoration-cyan-200/50 underline-offset-2 hover:text-cyan-100">
          {url}
        </a>
        {sufixo}
      </span>
    );
  });
}

function NavegacaoPassagens() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-none border-t border-white/10 bg-[#020617]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:max-w-sm">
      <div className="grid grid-cols-5 items-end gap-1 text-[11px] font-semibold">
        <Link href="/passagens" className="flex min-w-0 flex-col items-center gap-1 text-cyan-300">
          <span className="text-2xl leading-none">✈️</span>
          <span className="max-w-full truncate">Passagens</span>
        </Link>
        <Link href="/cabine" className="flex min-w-0 flex-col items-center gap-1 text-white/45">
          <span className="text-2xl leading-none">▶</span>
          <span className="max-w-full truncate">Cabine</span>
        </Link>
        <Link href="/minha-viagem" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-medium text-black shadow-lg" aria-label="Início">
          +
        </Link>
        <Link href="/roteiro" className="flex min-w-0 flex-col items-center gap-1 text-white/45">
          <span className="text-2xl leading-none">🧭</span>
          <span className="max-w-full truncate">Roteiro</span>
        </Link>
        <Link href="/minha-viagem" className="flex min-w-0 flex-col items-center gap-1 text-white/45">
          <span className="text-2xl leading-none">🗺️</span>
          <span className="max-w-full truncate">Destinos</span>
        </Link>
      </div>
    </nav>
  );
}

export default function Passagens() {
  const [modo, setModo] = useState<Modo>("assistente");
  const [mensagens, setMensagens] = useState<Mensagem[]>([mensagemInicial]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroChat, setErroChat] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [ida, setIda] = useState("");
  const [volta, setVolta] = useState("");
  const [passageiros, setPassageiros] = useState(1);
  const [buscando, setBuscando] = useState(false);
  const [estimativa, setEstimativa] = useState<Estimativa | null>(null);
  const [erroBusca, setErroBusca] = useState("");

  async function enviarMensagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    const proxima = { id: Date.now(), papel: "usuario" as const, texto: conteudo };
    const conversa = [...mensagens, proxima];
    setMensagens(conversa);
    setTexto("");
    setErroChat("");
    setEnviando(true);

    try {
      const response = await fetch("/api/assistente-passagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: conversa.map(({ papel, texto: mensagem }) => ({ papel, texto: mensagem })),
        }),
      });
      const body = (await response.json()) as { resposta?: string; error?: string };
      if (!response.ok || !body.resposta) throw new Error(body.error || "Não foi possível responder agora.");
      setMensagens((atual) => [...atual, { id: Date.now() + 1, papel: "assistente", texto: body.resposta! }]);
    } catch (error) {
      setErroChat(error instanceof Error ? error.message : "Não foi possível responder agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function buscarPassagens(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroBusca("");
    setEstimativa(null);
    setBuscando(true);

    try {
      const response = await fetch("/api/estimar-passagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem, destino, dataIda: ida, dataVolta: volta }),
      });
      const body = (await response.json()) as Estimativa & { error?: string };
      if (!response.ok || typeof body.valorEstimado !== "number") {
        throw new Error(body.error || "Não foi possível estimar a passagem.");
      }
      setEstimativa({
        ...body,
        valorEstimado: body.valorEstimado * passageiros,
        faixaMinima: body.faixaMinima * passageiros,
        faixaMaxima: body.faixaMaxima * passageiros,
      });
    } catch (error) {
      setErroBusca(error instanceof Error ? error.message : "Não foi possível estimar a passagem.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.25),transparent_28%),linear-gradient(160deg,#061b31_0%,#020617_58%,#05192b_100%)] pb-28 text-white">
      <header className="px-5 pb-5 pt-10">
        <Link href="/minha-viagem" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-2xl text-white/80" aria-label="Voltar">
          ‹
        </Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Sua próxima viagem</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Passagens</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">Encontre o melhor caminho para a sua viagem.</p>
      </header>

      <div className="mx-4 overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-slate-950/55 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="grid grid-cols-2 border-b border-white/10">
          <button type="button" onClick={() => setModo("assistente")} className={`flex items-center justify-center gap-2 px-3 py-4 text-sm font-bold transition ${modo === "assistente" ? "bg-cyan-400/10 text-cyan-300" : "text-white/55"}`}>
            <span>💬</span> Buscar com assistente
          </button>
          <button type="button" onClick={() => setModo("pesquisa")} className={`flex items-center justify-center gap-2 px-3 py-4 text-sm font-bold transition ${modo === "pesquisa" ? "bg-cyan-400/10 text-cyan-300" : "text-white/55"}`}>
            <span>⌕</span> Pesquisar passagens
          </button>
        </div>

        {modo === "assistente" ? (
          <section className="flex min-h-[35rem] flex-col p-4">
            <div className="flex-1 space-y-4">
              {mensagens.map((mensagem) => (
                <div key={mensagem.id} className={`flex gap-2 ${mensagem.papel === "usuario" ? "justify-end" : "justify-start"}`}>
                  {mensagem.papel === "assistente" && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm">✦</span>}
                  <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${mensagem.papel === "usuario" ? "rounded-br-md bg-blue-600/50 text-white" : "rounded-bl-md bg-white/10 text-white/90"}`}>
                    <TextoDaMensagem texto={mensagem.texto} />
                  </div>
                </div>
              ))}
              {enviando && <p className="ml-10 text-xs text-cyan-200/75">O assistente está pensando...</p>}
              {erroChat && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-200">{erroChat}</p>}
            </div>
            <form onSubmit={enviarMensagem} className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              <input value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Pergunte algo sobre sua viagem..." className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35" />
              <button type="submit" disabled={!texto.trim() || enviando} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-lg text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem">➤</button>
            </form>
          </section>
        ) : (
          <section className="p-4">
            <div className="mb-5 flex gap-3">
              <span className="text-3xl text-cyan-300">⌕</span>
              <div><h2 className="text-lg font-bold text-cyan-200">Pesquisar passagens</h2><p className="mt-1 text-sm text-white/60">Preencha os dados para estimar sua passagem.</p></div>
            </div>
            <form onSubmit={buscarPassagens} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-white/15 bg-white/[0.03] p-3"><span className="block text-xs text-white/45">De onde?</span><input required value={origem} onChange={(event) => setOrigem(event.target.value)} placeholder="Goiânia (GYN)" className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/55" /></label>
                <label className="rounded-xl border border-white/15 bg-white/[0.03] p-3"><span className="block text-xs text-white/45">Para onde?</span><input required value={destino} onChange={(event) => setDestino(event.target.value)} placeholder="São Paulo (GRU)" className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/55" /></label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="rounded-xl border border-white/15 bg-white/[0.03] p-3"><span className="block text-xs text-white/45">Ida</span><input required type="date" value={ida} onChange={(event) => setIda(event.target.value)} className="mt-1 w-full bg-transparent text-xs text-white outline-none [color-scheme:dark]" /><span className="mt-1 block text-xs text-white/70">{formatarData(ida)}</span></label>
                <label className="rounded-xl border border-white/15 bg-white/[0.03] p-3"><span className="block text-xs text-white/45">Volta</span><input type="date" value={volta} onChange={(event) => setVolta(event.target.value)} className="mt-1 w-full bg-transparent text-xs text-white outline-none [color-scheme:dark]" /><span className="mt-1 block text-xs text-white/70">{formatarData(volta)}</span></label>
                <label className="rounded-xl border border-white/15 bg-white/[0.03] p-3"><span className="block text-xs text-white/45">Passageiros</span><select value={passageiros} onChange={(event) => setPassageiros(Number(event.target.value))} className="mt-2 w-full bg-transparent text-sm text-white outline-none"><option className="bg-slate-900" value={1}>1 adulto</option><option className="bg-slate-900" value={2}>2 adultos</option><option className="bg-slate-900" value={3}>3 adultos</option><option className="bg-slate-900" value={4}>4 adultos</option></select></label>
              </div>
              <button type="submit" disabled={buscando} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">⌕ {buscando ? "Buscando..." : "Buscar passagens"}</button>
            </form>
            {erroBusca && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-3 text-xs leading-relaxed text-red-200">{erroBusca}</p>}
            {estimativa && <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Estimativa para {passageiros} {passageiros === 1 ? "passageiro" : "passageiros"}</p><p className="mt-2 text-3xl font-black text-emerald-300">{moeda(estimativa.valorEstimado)}</p><p className="mt-1 text-sm text-white/65">Faixa provável: {moeda(estimativa.faixaMinima)} a {moeda(estimativa.faixaMaxima)}.</p><p className="mt-3 text-xs leading-relaxed text-white/55">Confiança {estimativa.confianca}. {estimativa.observacao}</p></div>}
          </section>
        )}
      </div>
      <NavegacaoPassagens />
    </div>
  );
}
