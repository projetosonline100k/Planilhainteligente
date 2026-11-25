import { formatarDataHora } from "@/components/agente/api";
import { Mensagem } from "@/types/agente";

const ROTULO_AUTOR: Record<Mensagem["autor"], string> = {
  usuario: "Usuário",
  agente: "Agente",
  humano: "Você",
  sistema: "Sistema",
};

export default function BolhaMensagem({ mensagem, mostrarFerramentas = true }: { mensagem: Mensagem; mostrarFerramentas?: boolean }) {
  const recebida = mensagem.direcao === "entrada";

  if (mensagem.autor === "sistema") {
    return (
      <div className="mx-auto max-w-[90%] rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        Erro no agente: {mensagem.erro}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${recebida ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          recebida ? "rounded-tl-sm bg-white text-slate-800" : mensagem.autor === "humano" ? "rounded-tr-sm bg-amber-100 text-slate-900" : "rounded-tr-sm bg-[#d9fdd3] text-slate-900"
        }`}
      >
        {mensagem.tipo === "audio" && <span className="mb-1 block text-[11px] font-semibold text-slate-500">🎤 Áudio transcrito</span>}
        {mensagem.tipo === "oferta" && <span className="mb-1 block text-[11px] font-semibold text-emerald-700">Oferta automática</span>}
        {mensagem.texto}
      </div>
      <span className="mt-1 px-1 text-[10px] text-slate-400">
        {ROTULO_AUTOR[mensagem.autor]} · {formatarDataHora(mensagem.created_at)}
        {mensagem.duracao_ms ? ` · ${(mensagem.duracao_ms / 1000).toFixed(1)}s` : ""}
        {mensagem.cerebro ? ` · ${mensagem.cerebro.replace("claude-", "").replace(/-(\d)-(\d)$/, " $1.$2")}` : ""}
        {mensagem.pendente ? " · na fila do Claude…" : ""}
        {mensagem.erro ? <span className="text-red-500"> · não entregue: {mensagem.erro}</span> : null}
      </span>
      {mostrarFerramentas && mensagem.ferramentas?.length ? (
        <details className="mt-1 max-w-[85%] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">
            ⚙️ {mensagem.ferramentas.length} ação(ões): {mensagem.ferramentas.map((f) => f.nome).join(", ")}
          </summary>
          <div className="mt-2 space-y-2">
            {mensagem.ferramentas.map((ferramenta, indice) => (
              <div key={indice}>
                <p className="font-mono font-semibold text-slate-700">{ferramenta.nome}({JSON.stringify(ferramenta.argumentos)})</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 font-mono text-[10px] leading-snug">{JSON.stringify(ferramenta.resultado, null, 2)}</pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
