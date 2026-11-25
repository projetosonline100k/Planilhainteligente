"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, formatarDataHora, formatarTelefone } from "@/components/agente/api";
import { Contato } from "@/types/agente";

type Painel = {
  metricas: {
    contatos: number;
    novos7d: number;
    ativosHoje: number;
    mensagensHoje: number;
    viagensDesejadas: number;
    ofertasEnviadas14d: number;
    tempoMedioRespostaMs: number | null;
    erros14d: number;
    emModoHumano: number;
  };
  porDia: Array<{ dia: string; recebidas: number; enviadas: number; novosContatos: number }>;
  topDestinos: Array<{ destino: string; total: number }>;
  contatos: Contato[];
};

function Metrica({ titulo, valor, detalhe, alerta }: { titulo: string; valor: string | number; detalhe?: string; alerta?: boolean }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${alerta ? "text-red-600" : "text-slate-950"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-400">{detalhe}</p>}
    </article>
  );
}

export default function VisaoGeral({ onAbrirConversa }: { onAbrirConversa: (id: string) => void }) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setPainel(await adminApi<Painel>("/api/admin/agente/painel"));
      setErro("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar.");
    }
  }, []);

  useEffect(() => {
    const primeiro = setTimeout(() => void carregar(), 0);
    const intervalo = setInterval(() => void carregar(), 20_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [carregar]);

  if (erro) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  if (!painel) return <p className="text-sm text-slate-400">Carregando métricas…</p>;

  const { metricas } = painel;
  const maximo = Math.max(1, ...painel.porDia.map((d) => d.recebidas + d.enviadas));
  const contatosReais = painel.contatos.filter((c) => !c.simulado);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica titulo="Contatos no WhatsApp" valor={metricas.contatos} detalhe={`+${metricas.novos7d} nos últimos 7 dias`} />
        <Metrica titulo="Conversaram hoje" valor={metricas.ativosHoje} detalhe={`${metricas.mensagensHoje} mensagens hoje`} />
        <Metrica titulo="Destinos acompanhados" valor={metricas.viagensDesejadas} detalhe={`${metricas.ofertasEnviadas14d} ofertas enviadas (14 dias)`} />
        <Metrica
          titulo="Tempo médio de resposta"
          valor={metricas.tempoMedioRespostaMs ? `${(metricas.tempoMedioRespostaMs / 1000).toFixed(1)}s` : "—"}
          detalhe={metricas.erros14d ? `${metricas.erros14d} erros em 14 dias` : "Sem erros em 14 dias"}
          alerta={metricas.erros14d > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-bold text-slate-950">Mensagens por dia</h3>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Recebidas</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />Enviadas</span>
            </div>
          </div>
          <div className="mt-5 flex h-44 items-end gap-1.5">
            {painel.porDia.map((dia) => (
              <div key={dia.dia} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-col gap-0.5">
                  <div className="rounded-t-sm bg-sky-500" style={{ height: `${(dia.enviadas / maximo) * 160}px` }} />
                  <div className="rounded-b-sm bg-emerald-500" style={{ height: `${(dia.recebidas / maximo) * 160}px` }} />
                </div>
                <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
                  {dia.recebidas} recebidas · {dia.enviadas} enviadas · {dia.novosContatos} novos
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{painel.porDia[0]?.dia.split("-").reverse().slice(0, 2).join("/")}</span>
            <span>hoje</span>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-950">Destinos mais desejados</h3>
          {painel.topDestinos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Ninguém salvou destino ainda.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {painel.topDestinos.map((item) => (
                <li key={item.destino}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-slate-700">{item.destino}</span><span className="tabular-nums text-slate-500">{item.total}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${(item.total / painel.topDestinos[0].total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-bold text-slate-950">Últimos contatos</h3>
          {metricas.emModoHumano > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{metricas.emModoHumano} em atendimento humano</span>}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="pb-2 font-semibold">Contato</th><th className="pb-2 font-semibold">Entrou em</th><th className="pb-2 font-semibold">Última mensagem</th><th className="pb-2 text-right font-semibold">Msgs</th></tr>
            </thead>
            <tbody>
              {contatosReais.slice(0, 12).map((contato) => (
                <tr key={contato.id} onClick={() => onAbrirConversa(contato.id)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-2.5"><p className="font-medium text-slate-800">{contato.nome_preferido ?? contato.nome ?? "Sem nome"}</p><p className="text-xs text-slate-400">{formatarTelefone(contato.telefone)}</p></td>
                  <td className="py-2.5 text-slate-500">{formatarDataHora(contato.created_at)}</td>
                  <td className="py-2.5 text-slate-500">{formatarDataHora(contato.ultima_mensagem_em)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">{contato.total_mensagens}</td>
                </tr>
              ))}
              {contatosReais.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">Nenhum contato real ainda. Teste o agente na aba Simulador enquanto conecta o WhatsApp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
