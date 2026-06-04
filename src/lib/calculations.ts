import { DiagnosticoViagem, PlanoViagem } from "@/types/travel";

function calcularPeriodo(dataIda: string, hoje: Date): { dias: number; meses: number } {
  const ida = new Date(dataIda);

  const diffMs = ida.getTime() - hoje.getTime();
  const dias = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // Meses por calendário — mínimo 1 para não dividir por zero no cálculo financeiro
  const anosD = ida.getFullYear() - hoje.getFullYear();
  const mesesD = ida.getMonth() - hoje.getMonth();
  const ajusteDia = ida.getDate() < hoje.getDate() ? -1 : 0;
  const meses = Math.max(1, anosD * 12 + mesesD + ajusteDia);

  return { dias, meses };
}

function formatarMoeda(valor: number): string {
  return Math.ceil(valor).toLocaleString("pt-BR");
}

function pluralMes(n: number): string {
  return `${n} ${n === 1 ? "mês" : "meses"}`;
}

function pluralDia(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

export function calcularPlanoViagem(
  dados: DiagnosticoViagem,
  hoje: Date = new Date()
): PlanoViagem {
  const custoTotal =
    dados.valorPassagem +
    dados.valorHospedagem +
    dados.valorAlimentacao +
    dados.valorPasseios;

  const { dias: diasAteViagem, meses: mesesAteViagem } = calcularPeriodo(dados.dataIda, hoje);

  const valorNecessarioPorMes = custoTotal / mesesAteViagem;
  const consegueViajarNaData = dados.valorGuardadoPorMes >= valorNecessarioPorMes;

  // Guarda contra divisão por zero: sem valor guardado, retorna 0
  const mesesNecessariosComValorAtual =
    dados.valorGuardadoPorMes > 0
      ? Math.ceil(custoTotal / dados.valorGuardadoPorMes)
      : 0;

  let mensagemResumo: string;
  if (consegueViajarNaData) {
    if (diasAteViagem < 30) {
      mensagemResumo = `Você vai para ${dados.destino}. Com base nas suas informações, precisa ter R$ ${formatarMoeda(custoTotal)} em ${pluralDia(diasAteViagem)}.`;
    } else {
      mensagemResumo = `Você vai para ${dados.destino}. Com base nas suas informações, precisa guardar R$ ${formatarMoeda(valorNecessarioPorMes)} por mês durante ${pluralMes(mesesAteViagem)}.`;
    }
  } else {
    mensagemResumo = `Você vai para ${dados.destino}. Com base nas suas informações, precisa guardar R$ ${formatarMoeda(dados.valorGuardadoPorMes)} por mês durante ${pluralMes(mesesNecessariosComValorAtual)}.`;
  }

  return {
    custoTotal,
    diasAteViagem,
    mesesAteViagem,
    valorNecessarioPorMes,
    valorGuardadoPorMes: dados.valorGuardadoPorMes,
    consegueViajarNaData,
    mesesNecessariosComValorAtual,
    mensagemResumo,
  };
}
