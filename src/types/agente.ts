export type FerramentaAgente = "viagens_desejadas" | "ofertas" | "meta" | "pesquisa_web";

export type CerebroAgente = "openai" | "claude_assinatura";

export type AgenteConfig = {
  ativo: boolean;
  cerebro: CerebroAgente;
  modeloClaude: string;
  numerosClaude: string[];
  fallbackOpenAI: boolean;
  nome: string;
  prompt: string;
  boasVindas: string;
  respostaAudio: string;
  ferramentas: Record<FerramentaAgente, boolean>;
  ofertasProativas: boolean;
  descontoMinimo: number;
  maxOfertasPorDia: number;
  historico: number;
};

export type Contato = {
  id: string;
  telefone: string;
  nome: string | null;
  nome_preferido: string | null;
  cidade_origem: string | null;
  estado: string | null;
  aeroporto_origem: string | null;
  destino_perguntado: boolean;
  user_id: string | null;
  modo: "agente" | "humano";
  bloqueado: boolean;
  simulado: boolean;
  total_mensagens: number;
  ultima_mensagem_em: string | null;
  created_at: string;
};

export type ChamadaFerramenta = {
  nome: string;
  argumentos: Record<string, unknown>;
  resultado: unknown;
};

export type Mensagem = {
  id: string;
  contato_id: string;
  direcao: "entrada" | "saida";
  autor: "usuario" | "agente" | "humano" | "sistema";
  tipo: string;
  texto: string;
  ferramentas: ChamadaFerramenta[] | null;
  erro: string | null;
  duracao_ms: number | null;
  pendente: boolean;
  cerebro: string | null;
  created_at: string;
};

export type WorkerStatus = {
  online: boolean;
  ultimoSinal: string | null;
  host: string | null;
  modelo: string | null;
  whatsapp: string | null;
};

export type ViagemDesejada = {
  id: string;
  contato_id: string;
  destino: string;
  origem: string | null;
  data_viagem: string | null;
  custo_estimado: number | null;
  valor_guardado: number;
  guardar_por_mes: number | null;
  seguir_ofertas: boolean;
  created_at: string;
  updated_at: string;
};
