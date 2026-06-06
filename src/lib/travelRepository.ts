import { supabase } from "@/lib/supabase";
import {
  adicionarMovimentacao,
  atualizarViagemAtiva,
  apagarViagem,
  carregarStore,
  criarNovaViagem,
  definirViagemAtiva,
  obterViagemAtiva,
} from "@/lib/storage";
import {
  CategoriaMovimentacao,
  DiagnosticoViagem,
  Movimentacao,
  TipoMovimentacao,
  ViagemItem,
  ViagemStore,
} from "@/types/travel";

const CHAVE_VIAGEM_ATIVA_REMOTA = "viagem-supabase-active-trip-id";

type CategoriaBanco = "flight" | "lodging" | "food" | "activities";
type TipoBanco = "income" | "expense";

type TripRow = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  flight_cost: number | null;
  lodging_cost: number | null;
  food_cost: number | null;
  activities_cost: number | null;
  monthly_saving_capacity: number | null;
};

type TransactionRow = {
  id: string;
  trip_id: string;
  category: CategoriaBanco;
  type: TipoBanco;
  amount: number | null;
  created_at: string;
};

const categoriaParaBanco: Record<CategoriaMovimentacao, CategoriaBanco> = {
  passagem: "flight",
  hospedagem: "lodging",
  alimentacao: "food",
  passeios: "activities",
};

const categoriaDoBanco: Record<CategoriaBanco, CategoriaMovimentacao> = {
  flight: "passagem",
  lodging: "hospedagem",
  food: "alimentacao",
  activities: "passeios",
};

const tipoParaBanco: Record<TipoMovimentacao, TipoBanco> = {
  entrada: "income",
  saida: "expense",
};

const tipoDoBanco: Record<TipoBanco, TipoMovimentacao> = {
  income: "entrada",
  expense: "saida",
};

function getViagemAtivaRemotaId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAVE_VIAGEM_ATIVA_REMOTA);
}

function setViagemAtivaRemotaId(id: string | null): void {
  if (typeof window === "undefined") return;

  if (id) {
    localStorage.setItem(CHAVE_VIAGEM_ATIVA_REMOTA, id);
    return;
  }

  localStorage.removeItem(CHAVE_VIAGEM_ATIVA_REMOTA);
}

async function obterUsuarioId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function tripRowParaViagem(row: TripRow, movimentacoes: Movimentacao[]): ViagemItem {
  return {
    id: row.id,
    dados: {
      destino: row.destination,
      dataIda: row.start_date,
      dataVolta: row.end_date ?? "",
      valorPassagem: Number(row.flight_cost ?? 0),
      valorHospedagem: Number(row.lodging_cost ?? 0),
      valorAlimentacao: Number(row.food_cost ?? 0),
      valorPasseios: Number(row.activities_cost ?? 0),
      valorGuardadoPorMes: Number(row.monthly_saving_capacity ?? 0),
    },
    movimentacoes,
  };
}

function transactionRowParaMovimentacao(row: TransactionRow): Movimentacao {
  return {
    id: row.id,
    categoria: categoriaDoBanco[row.category],
    tipo: tipoDoBanco[row.type],
    valor: Number(row.amount ?? 0),
    dataCriacao: row.created_at,
  };
}

function dadosParaTripPayload(dados: DiagnosticoViagem, userId: string) {
  return {
    user_id: userId,
    destination: dados.destino,
    start_date: dados.dataIda,
    end_date: dados.dataVolta || null,
    flight_cost: dados.valorPassagem,
    lodging_cost: dados.valorHospedagem,
    food_cost: dados.valorAlimentacao,
    activities_cost: dados.valorPasseios,
    monthly_saving_capacity: dados.valorGuardadoPorMes,
  };
}

function movimentacaoParaTransactionPayload(
  mov: Movimentacao,
  tripId: string,
  userId: string
) {
  return {
    user_id: userId,
    trip_id: tripId,
    category: categoriaParaBanco[mov.categoria],
    type: tipoParaBanco[mov.tipo],
    amount: mov.valor,
    created_at: mov.dataCriacao,
  };
}

function definirViagemAtivaValida(viagens: ViagemItem[]): string | null {
  const ativaSalva = getViagemAtivaRemotaId();
  const ativaExiste = viagens.some((viagem) => viagem.id === ativaSalva);
  const viagemAtivaId = ativaExiste ? ativaSalva : viagens[0]?.id ?? null;

  setViagemAtivaRemotaId(viagemAtivaId);
  return viagemAtivaId;
}

async function carregarStoreRemoto(userId: string): Promise<ViagemStore> {
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select(
      "id, destination, start_date, end_date, flight_cost, lodging_cost, food_cost, activities_cost, monthly_saving_capacity"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (tripsError) throw tripsError;

  const tripRows = (trips ?? []) as TripRow[];
  const tripIds = tripRows.map((trip) => trip.id);
  let transactionRows: TransactionRow[] = [];

  if (tripIds.length > 0) {
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("id, trip_id, category, type, amount, created_at")
      .in("trip_id", tripIds)
      .order("created_at", { ascending: false });

    if (transactionsError) throw transactionsError;
    transactionRows = (transactions ?? []) as TransactionRow[];
  }

  const movimentacoesPorViagem = transactionRows.reduce<Record<string, Movimentacao[]>>(
    (acc, transaction) => {
      acc[transaction.trip_id] = acc[transaction.trip_id] ?? [];
      acc[transaction.trip_id].push(transactionRowParaMovimentacao(transaction));
      return acc;
    },
    {}
  );

  const viagens = tripRows.map((trip) =>
    tripRowParaViagem(trip, movimentacoesPorViagem[trip.id] ?? [])
  );

  return {
    viagens,
    viagemAtivaId: definirViagemAtivaValida(viagens),
  };
}

export async function carregarViagemStore(): Promise<ViagemStore> {
  const userId = await obterUsuarioId();
  if (!userId) return carregarStore();

  return carregarStoreRemoto(userId);
}

export async function obterViagemAtivaRepository(): Promise<ViagemItem | null> {
  const userId = await obterUsuarioId();
  if (!userId) return obterViagemAtiva();

  const store = await carregarStoreRemoto(userId);
  return store.viagens.find((viagem) => viagem.id === store.viagemAtivaId) ?? null;
}

export async function criarViagem(dados: DiagnosticoViagem): Promise<ViagemStore> {
  const userId = await obterUsuarioId();

  if (!userId) {
    criarNovaViagem(dados);
    return carregarStore();
  }

  const { data, error } = await supabase
    .from("trips")
    .insert(dadosParaTripPayload(dados, userId))
    .select("id")
    .single();

  if (error) throw error;

  setViagemAtivaRemotaId(data.id);
  return carregarStoreRemoto(userId);
}

export async function atualizarViagemAtivaRepository(
  dados: DiagnosticoViagem
): Promise<ViagemStore> {
  const userId = await obterUsuarioId();

  if (!userId) {
    atualizarViagemAtiva(dados);
    return carregarStore();
  }

  const tripId = getViagemAtivaRemotaId();
  if (!tripId) throw new Error("Nenhuma viagem ativa encontrada.");

  const { error } = await supabase
    .from("trips")
    .update(dadosParaTripPayload(dados, userId))
    .eq("id", tripId)
    .eq("user_id", userId);

  if (error) throw error;

  return carregarStoreRemoto(userId);
}

export async function definirViagemAtivaRepository(id: string): Promise<ViagemStore> {
  const userId = await obterUsuarioId();

  if (!userId) {
    definirViagemAtiva(id);
    return carregarStore();
  }

  setViagemAtivaRemotaId(id);
  return carregarStoreRemoto(userId);
}

export async function apagarViagemRepository(id: string): Promise<ViagemStore> {
  const userId = await obterUsuarioId();

  if (!userId) {
    apagarViagem(id);
    return carregarStore();
  }

  const { error: transactionsError } = await supabase
    .from("transactions")
    .delete()
    .eq("trip_id", id)
    .eq("user_id", userId);

  if (transactionsError) throw transactionsError;

  const { error: tripError } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (tripError) throw tripError;

  if (getViagemAtivaRemotaId() === id) {
    setViagemAtivaRemotaId(null);
  }

  return carregarStoreRemoto(userId);
}

export async function adicionarMovimentacaoRepository(
  mov: Movimentacao
): Promise<ViagemStore> {
  const userId = await obterUsuarioId();

  if (!userId) {
    adicionarMovimentacao(mov);
    return carregarStore();
  }

  const tripId = getViagemAtivaRemotaId();
  if (!tripId) throw new Error("Nenhuma viagem ativa encontrada.");

  const { error } = await supabase
    .from("transactions")
    .insert(movimentacaoParaTransactionPayload(mov, tripId, userId));

  if (error) throw error;

  return carregarStoreRemoto(userId);
}
