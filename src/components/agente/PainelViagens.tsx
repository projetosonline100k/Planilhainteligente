import { moeda } from "@/components/agente/api";
import { calcularStatusMeta, SituacaoMeta } from "@/lib/agente/meta";
import { ViagemDesejada } from "@/types/agente";

const SITUACAO: Record<SituacaoMeta, { rotulo: string; cor: string }> = {
  sem_dados: { rotulo: "Sem meta", cor: "bg-slate-100 text-slate-600" },
  concluida: { rotulo: "Meta batida", cor: "bg-emerald-100 text-emerald-800" },
  perto: { rotulo: "Perto", cor: "bg-emerald-100 text-emerald-800" },
  no_caminho: { rotulo: "No caminho", cor: "bg-sky-100 text-sky-800" },
  longe: { rotulo: "Longe", cor: "bg-amber-100 text-amber-800" },
};

export default function PainelViagens({ viagens }: { viagens: ViagemDesejada[] }) {
  if (!viagens.length) return <p className="text-sm text-slate-400">Nenhum destino salvo ainda.</p>;

  return (
    <ul className="space-y-3">
      {viagens.map((viagem) => {
        const status = calcularStatusMeta(viagem);
        const situacao = SITUACAO[status.situacao];
        return (
          <li key={viagem.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">{viagem.destino}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${situacao.cor}`}>{situacao.rotulo}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {viagem.origem ? `Saindo de ${viagem.origem} · ` : ""}
              {viagem.data_viagem ? viagem.data_viagem.split("-").reverse().join("/") : "sem data"}
              {viagem.seguir_ofertas ? " · 🔔 ofertas" : ""}
            </p>
            {status.custo ? (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${status.percentual ?? 0}%` }} /></div>
                <p className="mt-1 text-xs text-slate-500">{moeda(status.guardado)} de {moeda(status.custo)} ({status.percentual}%)</p>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
