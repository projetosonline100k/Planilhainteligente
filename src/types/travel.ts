export type DiagnosticoViagem = {
  destino: string;
  dataIda: string;
  dataVolta: string;
  valorPassagem: number;
  valorHospedagem: number;
  valorAlimentacao: number;
  valorPasseios: number;
  valorGuardadoPorMes: number;
};

export type PlanoViagem = {
  custoTotal: number;
  diasAteViagem: number;
  mesesAteViagem: number;
  valorNecessarioPorMes: number;
  valorGuardadoPorMes: number;
  consegueViajarNaData: boolean;
  mesesNecessariosComValorAtual: number;
  mensagemResumo: string;
};

export type CategoriaMovimentacao = "passagem" | "hospedagem" | "alimentacao" | "passeios";
export type TipoMovimentacao = "entrada" | "saida";

export type Movimentacao = {
  id: string;
  categoria: CategoriaMovimentacao;
  tipo: TipoMovimentacao;
  valor: number;
  dataCriacao: string;
};

export type ViagemItem = {
  id: string;
  dados: DiagnosticoViagem;
  movimentacoes: Movimentacao[];
};

export type ViagemStore = {
  viagens: ViagemItem[];
  viagemAtivaId: string | null;
};
