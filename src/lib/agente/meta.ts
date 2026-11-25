export type SituacaoMeta = "sem_dados" | "concluida" | "perto" | "no_caminho" | "longe";

export type StatusMeta = {
  situacao: SituacaoMeta;
  custo: number | null;
  guardado: number;
  falta: number | null;
  percentual: number | null;
  diasAteViagem: number | null;
  mesesAteViagem: number | null;
  precisaPorMes: number | null;
  guardaPorMes: number | null;
  mesesNoRitmoAtual: number | null;
  faltando: string[];
};

function dataLocal(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function calcularStatusMeta(
  viagem: { custo_estimado: number | null; valor_guardado: number; data_viagem: string | null; guardar_por_mes: number | null },
  hoje: Date = new Date()
): StatusMeta {
  const custo = viagem.custo_estimado && viagem.custo_estimado > 0 ? Number(viagem.custo_estimado) : null;
  const guardado = Math.max(0, Number(viagem.valor_guardado) || 0);
  const guardaPorMes = viagem.guardar_por_mes && viagem.guardar_por_mes > 0 ? Number(viagem.guardar_por_mes) : null;

  const faltando: string[] = [];
  if (!custo) faltando.push("custo_estimado");
  if (!viagem.data_viagem) faltando.push("data_viagem");

  let diasAteViagem: number | null = null;
  let mesesAteViagem: number | null = null;
  if (viagem.data_viagem) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    diasAteViagem = Math.max(0, Math.ceil((dataLocal(viagem.data_viagem).getTime() - inicio.getTime()) / 86_400_000));
    mesesAteViagem = Math.max(1, Math.ceil(diasAteViagem / 30));
  }

  if (!custo) {
    return { situacao: "sem_dados", custo, guardado, falta: null, percentual: null, diasAteViagem, mesesAteViagem, precisaPorMes: null, guardaPorMes, mesesNoRitmoAtual: null, faltando };
  }

  const falta = Math.max(0, custo - guardado);
  const percentual = Math.min(100, Math.round((guardado / custo) * 100));
  const precisaPorMes = mesesAteViagem ? Math.ceil(falta / mesesAteViagem) : null;
  const mesesNoRitmoAtual = guardaPorMes ? Math.ceil(falta / guardaPorMes) : null;

  let situacao: SituacaoMeta;
  if (falta === 0) situacao = "concluida";
  else if (percentual >= 75) situacao = "perto";
  else if (precisaPorMes !== null && guardaPorMes !== null) situacao = guardaPorMes >= precisaPorMes ? "no_caminho" : "longe";
  else situacao = percentual >= 40 ? "no_caminho" : "longe";

  return { situacao, custo, guardado, falta, percentual, diasAteViagem, mesesAteViagem, precisaPorMes, guardaPorMes, mesesNoRitmoAtual, faltando };
}
