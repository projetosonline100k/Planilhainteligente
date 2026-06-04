import { DiagnosticoViagem, Movimentacao, ViagemItem, ViagemStore } from "@/types/travel";

const CHAVE_STORE = "viagem-store";
const CHAVE_LEGACY_DIAG = "viagem-diagnostico";
const CHAVE_LEGACY_MOVS = "viagem-movimentacoes";

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Store principal ──────────────────────────────────────────────────────────

export function carregarStore(): ViagemStore {
  if (typeof window === "undefined") return { viagens: [], viagemAtivaId: null };

  try {
    const raw = localStorage.getItem(CHAVE_STORE);
    if (raw) return JSON.parse(raw) as ViagemStore;

    // Migração automática do formato antigo
    const rawDiag = localStorage.getItem(CHAVE_LEGACY_DIAG);
    if (rawDiag) {
      const dados = JSON.parse(rawDiag) as DiagnosticoViagem;
      const rawMovs = localStorage.getItem(CHAVE_LEGACY_MOVS);
      const movimentacoes: Movimentacao[] = rawMovs ? JSON.parse(rawMovs) : [];

      const viagem: ViagemItem = { id: gerarId(), dados, movimentacoes };
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
  const nova: ViagemItem = { id: gerarId(), dados, movimentacoes: [] };
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

export function definirViagemAtiva(id: string): void {
  if (typeof window === "undefined") return;
  const store = carregarStore();
  salvarStore({ ...store, viagemAtivaId: id });
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
