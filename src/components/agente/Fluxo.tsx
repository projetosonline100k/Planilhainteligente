"use client";

import { ReactNode, useEffect, useState } from "react";
import { adminApi, formatarDataHora } from "@/components/agente/api";
import { AgenteConfig, FerramentaAgente, WorkerStatus } from "@/types/agente";

type Conexao = { whapi: boolean; openai: boolean; webhookSecret: boolean; cron: boolean; webhookUrl: string; modelo: string };
type RespostaConfig = {
  config: AgenteConfig;
  updatedAt: string | null;
  padrao: AgenteConfig;
  conexao: Conexao;
  ferramentas: Record<FerramentaAgente, { titulo: string; descricao: string; funcoes: string[] }>;
  modelosClaude: Array<{ id: string; nome: string }>;
  worker: WorkerStatus;
};

function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (valor: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={() => onChange(!ligado)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${ligado ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Etapa({ numero, titulo, subtitulo, children, ativo = true, ultimo = false }: { numero: string; titulo: string; subtitulo: string; children?: ReactNode; ativo?: boolean; ultimo?: boolean }) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ativo ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-500"}`}>{numero}</span>
        {!ultimo && <span className="w-0.5 flex-1 bg-slate-200" />}
      </div>
      <div className={`mb-5 min-w-0 flex-1 rounded-2xl border bg-white p-4 ${ativo ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
        <p className="font-bold text-slate-900">{titulo}</p>
        <p className="text-xs text-slate-500">{subtitulo}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

function Status({ ok, rotulo, variavel }: { ok: boolean; rotulo: string; variavel: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? "bg-emerald-500" : "bg-amber-500"}`}>{ok ? "✓" : "!"}</span>
      <span><span className="font-medium text-slate-800">{rotulo}</span><br /><code className="text-[11px] text-slate-500">{variavel}</code></span>
    </li>
  );
}

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

export default function Fluxo() {
  const [dados, setDados] = useState<RespostaConfig | null>(null);
  const [config, setConfig] = useState<AgenteConfig | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [rodandoOfertas, setRodandoOfertas] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    adminApi<RespostaConfig>("/api/admin/agente/config")
      .then((body) => {
        setDados(body);
        setConfig(body.config);
      })
      .catch((error: Error) => setAviso({ tipo: "erro", texto: error.message }));
  }, []);

  if (!config || !dados) return aviso ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{aviso.texto}</p> : <p className="text-sm text-slate-400">Carregando fluxo…</p>;

  const alterado = JSON.stringify(config) !== JSON.stringify(dados.config);
  const atualizar = (parcial: Partial<AgenteConfig>) => setConfig({ ...config, ...parcial });
  const conexao = dados.conexao;
  const worker = dados.worker;
  const usaClaude = config.cerebro === "claude_assinatura";
  const whatsappOnline = worker.online && worker.whatsapp === "WORKING";
  const rotuloWhatsapp: Record<string, string> = {
    WORKING: "conectado",
    SCAN_QR_CODE: "esperando o QR Code",
    STARTING: "iniciando",
    FAILED: "falhou, rode npm run whatsapp",
    STOPPED: "parado",
    WAHA_DESLIGADO: "WAHA desligado, rode npm run whatsapp",
  };

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    setAviso(null);
    try {
      const body = await adminApi<{ config: AgenteConfig; updatedAt: string }>("/api/admin/agente/config", { method: "PUT", body: JSON.stringify({ config }) });
      setDados((atual) => (atual ? { ...atual, config: body.config, updatedAt: body.updatedAt } : atual));
      setConfig(body.config);
      setAviso({ tipo: "ok", texto: "Fluxo salvo. Já vale para a próxima mensagem." });
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao salvar." });
    } finally {
      setSalvando(false);
    }
  }

  async function rodarOfertas() {
    setRodandoOfertas(true);
    setAviso(null);
    try {
      const body = await adminApi<{ enviadas: number; contatos: number; motivo?: string }>("/api/admin/agente/ofertas", { method: "POST" });
      setAviso({ tipo: "ok", texto: body.motivo ?? `${body.enviadas} ofertas enviadas para ${body.contatos} contatos que seguem destinos.` });
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao enviar ofertas." });
    } finally {
      setRodandoOfertas(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        <div className="sticky top-0 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Chave ligado={config.ativo} onChange={(ativo) => atualizar({ ativo })} rotulo="Agente ligado" />
            <div>
              <p className="font-bold text-slate-900">{config.ativo ? "Agente ligado" : "Agente desligado"}</p>
              <p className="text-xs text-slate-500">{config.ativo ? "Respondendo mensagens reais do WhatsApp" : "Só o simulador responde. Ligue quando estiver pronto."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dados.updatedAt && <span className="hidden text-xs text-slate-400 sm:inline">Salvo em {formatarDataHora(dados.updatedAt)}</span>}
            <button type="button" onClick={salvar} disabled={!alterado || salvando} className="rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:bg-slate-300">
              {salvando ? "Salvando…" : alterado ? "Salvar fluxo" : "Salvo"}
            </button>
          </div>
        </div>

        {aviso && <p className={`mb-4 rounded-xl px-4 py-3 text-sm ${aviso.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{aviso.texto}</p>}

        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Quando a pessoa manda mensagem</h3>

        <Etapa
          numero="1"
          titulo="Mensagem chega no WhatsApp"
          subtitulo={whatsappOnline ? "WAHA conectado no número do agente e entregando ao worker" : "WAHA no seu Mac recebe e entrega ao worker (npm run whatsapp + npm run agente)"}
          ativo={whatsappOnline || conexao.whapi}
        />

        <Etapa numero="2" titulo="Filtros de entrada" subtitulo="Antes de chamar a IA">
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>• Grupos e mensagens enviadas por você são ignorados</li>
            <li>• Contato bloqueado → não responde</li>
            <li>• Conversa assumida por humano → não responde</li>
            <li>• Áudio → transcrito automaticamente. Se falhar, responde:</li>
          </ul>
          <input value={config.respostaAudio} onChange={(e) => atualizar({ respostaAudio: e.target.value })} className={`${campo} mt-2`} />
        </Etapa>

        <Etapa
          numero="3"
          titulo="Cérebro do agente"
          subtitulo={`${usaClaude ? config.modeloClaude : `GPT (${conexao.modelo})`} · lê as últimas ${config.historico} mensagens`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { id: "claude_assinatura", titulo: "Claude da assinatura", detalhe: "Usa o seu plano do Claude. Precisa do worker rodando." },
              { id: "openai", titulo: "GPT (OpenAI)", detalhe: "Pago por uso na OpenAI. Roda direto na Vercel." },
            ] as const).map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() => atualizar({ cerebro: opcao.id })}
                className={`rounded-xl border p-3 text-left transition ${config.cerebro === opcao.id ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200 hover:border-slate-300"}`}
              >
                <p className="text-sm font-semibold text-slate-800">{opcao.titulo}</p>
                <p className="mt-0.5 text-xs text-slate-500">{opcao.detalhe}</p>
              </button>
            ))}
          </div>

          {usaClaude && (
            <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
              <p className={`flex items-center gap-2 text-xs font-semibold ${worker.online ? "text-emerald-700" : "text-amber-700"}`}>
                <span className={`h-2 w-2 rounded-full ${worker.online ? "bg-emerald-500" : "bg-amber-500"}`} />
                {worker.online ? `Worker online em ${worker.host ?? "?"}` : "Worker offline: rode npm run agente"}
              </p>
              <label className="block"><span className="text-xs font-medium text-slate-600">Modelo do Claude</span>
                <select value={config.modeloClaude} onChange={(e) => atualizar({ modeloClaude: e.target.value })} className={`${campo} mt-1 bg-white`}>
                  {dados.modelosClaude.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium text-slate-600">Números que usam o Claude (um por linha, vazio = todos)</span>
                <textarea
                  key={dados.updatedAt ?? "novo"}
                  defaultValue={config.numerosClaude.join("\n")}
                  onBlur={(e) => atualizar({ numerosClaude: e.target.value.split(/[\n,]/).map((linha) => linha.replace(/\D/g, "")).filter(Boolean) })}
                  rows={2}
                  placeholder="5511998924196"
                  className={`${campo} mt-1 bg-white font-mono text-xs`}
                />
              </label>
              <div className="flex items-start gap-3">
                <Chave ligado={config.fallbackOpenAI} onChange={(fallbackOpenAI) => atualizar({ fallbackOpenAI })} rotulo="Reserva com GPT" />
                <span className="text-xs text-slate-600">Se o worker estiver desligado ou o Claude falhar, o GPT responde no lugar. Desligado, a mensagem espera na fila até o worker voltar.</span>
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="block"><span className="text-xs font-medium text-slate-600">Nome do agente</span><input value={config.nome} onChange={(e) => atualizar({ nome: e.target.value })} className={`${campo} mt-1`} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-600">Memória (msgs)</span><input type="number" min={2} max={40} value={config.historico} onChange={(e) => atualizar({ historico: Number(e.target.value) })} className={`${campo} mt-1`} /></label>
          </div>
          <label className="mt-3 block"><span className="text-xs font-medium text-slate-600">Primeira mensagem (boas-vindas)</span><textarea value={config.boasVindas} onChange={(e) => atualizar({ boasVindas: e.target.value })} rows={2} className={`${campo} mt-1`} /></label>
          <label className="mt-3 block">
            <span className="flex items-center justify-between text-xs font-medium text-slate-600">
              Instruções (prompt)
              <button type="button" onClick={() => atualizar({ prompt: dados.padrao.prompt })} className="font-semibold text-cyan-700 hover:underline">Restaurar padrão</button>
            </span>
            <textarea value={config.prompt} onChange={(e) => atualizar({ prompt: e.target.value })} rows={14} maxLength={20_000} className={`${campo} mt-1 font-mono text-xs leading-relaxed`} />
          </label>
        </Etapa>

        <Etapa numero="4" titulo="Ferramentas" subtitulo="O que o agente consegue fazer além de conversar">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(dados.ferramentas) as FerramentaAgente[]).map((chave) => {
              const ferramenta = dados.ferramentas[chave];
              const ligada = config.ferramentas[chave];
              return (
                <div key={chave} className={`rounded-xl border p-3 ${ligada ? "border-cyan-200 bg-cyan-50/50" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{ferramenta.titulo}</p>
                    <Chave ligado={ligada} onChange={(valor) => atualizar({ ferramentas: { ...config.ferramentas, [chave]: valor } })} rotulo={ferramenta.titulo} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{ferramenta.descricao}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">{ferramenta.funcoes.join(" · ")}</p>
                </div>
              );
            })}
          </div>
        </Etapa>

        <Etapa numero="5" titulo="Resposta enviada" subtitulo="Volta pelo WhatsApp e fica salva em Conversas" ultimo />

        <h3 className="mb-3 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Quando o agente puxa conversa</h3>

        <Etapa numero="A" titulo="Radar acha passagens" subtitulo="Fluxo do n8n salva as promoções em flight_offers todo dia às 04:00" />
        <Etapa numero="B" titulo="Cruza com os destinos desejados" subtitulo="Todo dia às 10:00 (cron) ou quando você clicar em rodar agora" ativo={config.ofertasProativas}>
          <div className="flex items-center gap-3">
            <Chave ligado={config.ofertasProativas} onChange={(ofertasProativas) => atualizar({ ofertasProativas })} rotulo="Ofertas proativas" />
            <span className="text-sm text-slate-700">Avisar sobre passagens para os destinos que a pessoa segue</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium text-slate-600">Desconto mínimo (%)</span><input type="number" min={0} max={90} value={config.descontoMinimo} onChange={(e) => atualizar({ descontoMinimo: Number(e.target.value) })} className={`${campo} mt-1`} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-600">Máx. ofertas por pessoa/dia</span><input type="number" min={0} max={10} value={config.maxOfertasPorDia} onChange={(e) => atualizar({ maxOfertasPorDia: Number(e.target.value) })} className={`${campo} mt-1`} /></label>
          </div>
          <button type="button" onClick={rodarOfertas} disabled={rodandoOfertas || alterado} className="mt-3 rounded-full border border-cyan-300 px-4 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50">
            {rodandoOfertas ? "Enviando…" : alterado ? "Salve antes de rodar" : "Rodar agora"}
          </button>
        </Etapa>
        <Etapa numero="C" titulo="Mensagem de oferta no WhatsApp" subtitulo="Sem repetir oferta já enviada para a mesma pessoa" ativo={config.ofertasProativas} ultimo />
      </div>

      <aside className="space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-slate-900">Conexões</h3>
          <ul className="mt-3 space-y-3">
            <Status
              ok={whatsappOnline}
              rotulo={`WhatsApp (WAHA): ${worker.online ? rotuloWhatsapp[worker.whatsapp ?? ""] ?? worker.whatsapp ?? "sem WAHA" : "worker desligado"}`}
              variavel="npm run whatsapp"
            />
            <Status ok={worker.online} rotulo={worker.online ? `Worker online em ${worker.host ?? "?"}` : "Worker desligado"} variavel="npm run agente" />
            <Status ok={conexao.openai} rotulo="GPT (reserva)" variavel="OPENAI_API_KEY" />
            <Status ok={conexao.cron} rotulo="Cron das ofertas" variavel="CRON_SECRET" />
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-slate-900">Como ligar (grátis, no seu Mac)</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-slate-600">
            <li><code className="rounded bg-slate-100 px-1">npm run whatsapp</code> liga o WAHA. Na primeira vez abre um QR Code: escaneie com o WhatsApp do número do agente em <em>Aparelhos conectados</em>.</li>
            <li><code className="rounded bg-slate-100 px-1">npm run agente</code> liga o worker e deixa o Terminal aberto.</li>
            <li>Ligue a chave <strong>Agente ligado</strong> aqui em cima.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">Com o Mac desligado o agente para. Depois a gente sobe os dois comandos na VPS.</p>
        </article>
      </aside>
    </div>
  );
}
