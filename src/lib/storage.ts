import { DiagnosticoViagem, Movimentacao, ViagemItem, ViagemStore } from "@/types/travel";

const CHAVE_STORE = "viagem-store";
const CHAVE_LEGACY_DIAG = "viagem-diagnostico";
const CHAVE_LEGACY_MOVS = "viagem-movimentacoes";

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizarDados(dados: Partial<DiagnosticoViagem>): DiagnosticoViagem {
  return {
    cidadeOrigem: dados.cidadeOrigem ?? "",
    destino: dados.destino ?? "",
    dataIda: dados.dataIda ?? "",
    dataVolta: dados.dataVolta ?? "",
    valorPassagem: dados.valorPassagem ?? 0,
    valorHospedagem: dados.valorHospedagem ?? 0,
    valorAlimentacao: dados.valorAlimentacao ?? 0,
    valorPasseios: dados.valorPasseios ?? 0,
    valorGuardadoPorMes: dados.valorGuardadoPorMes ?? 150,
  };
}

function normalizarStore(store: ViagemStore): ViagemStore {
  return {
    ...store,
    viagens: store.viagens.map((viagem) => ({
      ...viagem,
      dados: normalizarDados(viagem.dados),
      concluida: viagem.concluida ?? false,
      dataConclusao: viagem.dataConclusao,
    })),
  };
}

// ─── Store principal ──────────────────────────────────────────────────────────

export function carregarStore(): ViagemStore {
  if (typeof window === "undefined") return { viagens: [], viagemAtivaId: null };

  try {
    const raw = localStorage.getItem(CHAVE_STORE);
    if (raw) return normalizarStore(JSON.parse(raw) as ViagemStore);

    // Migração automática do formato antigo
    const rawDiag = localStorage.getItem(CHAVE_LEGACY_DIAG);
    if (rawDiag) {
      const dados = normalizarDados(JSON.parse(rawDiag) as DiagnosticoViagem);
      const rawMovs = localStorage.getItem(CHAVE_LEGACY_MOVS);
      const movimentacoes: Movimentacao[] = rawMovs ? JSON.parse(rawMovs) : [];

      const viagem: ViagemItem = {
        id: gerarId(),
        dados,
        movimentacoes,
        concluida: false,
      };
      const store: ViagemStore = { viagens: [viagem], viagemAtivaId: viagem.id };

      localStorage.setItem(CHAVE_STORE, JSON.stringify(store));
      localStorage.removeItem(CHAVE_LEGACY_DIAG);
      localStorage.removeItem(CHAVE_LEGACY_MOVS);

      return store;
    }
  } catch {}

  return { viagens: [], viagemAtivaId: null };
}

export function salvarStore(store: ViagemStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE_STORE, JSON.stringify(store));
}

// ─── Viagem ativa ─────────────────────────────────────────────────────────────

export function obterViagemAtiva(): ViagemItem | null {
  const store = carregarStore();
  if (!store.viagemAtivaId) return null;
  return store.viagens.find((v) => v.id === store.viagemAtivaId) ?? null;
}

export function criarNovaViagem(dados: DiagnosticoViagem): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  const nova: ViagemItem = { id: gerarId(), dados, movimentacoes: [], concluida: false };
  salvarStore({ viagens: [...store.viagens, nova], viagemAtivaId: nova.id });
}

export function atualizarViagemAtiva(dados: DiagnosticoViagem): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  salvarStore({
    ...store,
    viagens: store.viagens.map((v) =>
      v.id === store.viagemAtivaId ? { ...v, dados } : v
    ),
  });
}

export function concluirViagem(id: string): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  salvarStore({
    ...store,
    viagens: store.viagens.map((viagem) =>
      viagem.id === id
        ? { ...viagem, concluida: true, dataConclusao: new Date().toISOString() }
        : viagem
    ),
  });
}

export function definirViagemAtiva(id: string): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  salvarStore({ ...store, viagemAtivaId: id });
}

export function apagarViagem(id: string): void {
  if (typeof window === "undefined") return;

  const store = carregarStore();
  const viagens = store.viagens.filter((viagem) => viagem.id !== id);
  const viagemAtivaId =
    store.viagemAtivaId === id ? viagens[0]?.id ?? null : store.viagemAtivaId;

  salvarStore({ viagens, viagemAtivaId });
}

// ─── Movimentações (sempre na viagem ativa) ───────────────────────────────────

export function adicionarMovimentacao(mov: Movimentacao): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  salvarStore({
    ...store,
    viagens: store.viagens.map((v) =>
      v.id === store.viagemAtivaId
        ? { ...v, movimentacoes: [...v.movimentacoes, mov] }
        : v
    ),
  });
}
