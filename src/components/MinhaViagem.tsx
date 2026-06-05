"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Movimentacao,
  CategoriaMovimentacao,
  TipoMovimentacao,
  ViagemItem,
  ViagemStore,
} from "@/types/travel";
import { calcularPlanoViagem } from "@/lib/calculations";
import {
  adicionarMovimentacaoRepository,
  carregarViagemStore,
  definirViagemAtivaRepository,
} from "@/lib/travelRepository";
import { supabase } from "@/lib/supabase";

const STORE_VAZIO: ViagemStore = { viagens: [], viagemAtivaId: null };

// ─── Cálculo de capital reservado por categoria ───────────────────────────────

function calcularReservado(movs: Movimentacao[], categoria: CategoriaMovimentacao): number {
  const total = movs
    .filter((m) => m.categoria === categoria)
    .reduce((acc, m) => (m.tipo === "entrada" ? acc + m.valor : acc - m.valor), 0);
  return Math.max(0, total);
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  if (!iso) return "";
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function formatarDataCompleta(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ─── Anel de progresso (SVG puro) ─────────────────────────────────────────────

function AnelProgresso({ percentual, consegue }: { percentual: number; consegue: boolean }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percentual));
  const offset = circ * (1 - p / 100);
  const cor = consegue ? "#22c55e" : "#f59e0b";

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r}
          fill="none" stroke={cor} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-gray-900">{Math.round(p)}%</span>
        <span className="text-[10px] text-gray-400 text-center leading-tight px-1">
          reservado
        </span>
      </div>
    </div>
  );
}

// ─── Item de legenda ──────────────────────────────────────────────────────────

function LegendaItem({ cor, label, valor }: { cor: string; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cor}`} />
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 leading-none">{label}</p>
        <p className="text-[11px] font-semibold text-gray-900 mt-0.5">{valor}</p>
      </div>
    </div>
  );
}

// ─── Mini card de categoria ───────────────────────────────────────────────────

function CardCategoria({
  emoji, nome, meta, reservado, cor,
}: {
  emoji: string;
  nome: string;
  meta: number;
  reservado: number;
  cor: string;
}) {
  const percentual = meta > 0 ? Math.min(100, (reservado / meta) * 100) : 0;

  return (
    <div className="min-w-[96px] shrink-0 rounded-xl border border-gray-100 bg-white p-3 flex flex-col gap-1.5">
      <span className="text-2xl leading-none">{emoji}</span>
      <div>
        <p className="text-xs text-gray-500">{nome}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Meta: {moeda(meta)}</p>
        <p className="text-sm font-bold text-gray-900">{moeda(reservado)}</p>
        <p className="text-xs text-gray-400">{Math.round(percentual)}%</p>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${cor} rounded-full`} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

// ─── Modal "Adicionar Capital" ────────────────────────────────────────────────

const CATEGORIAS: { id: CategoriaMovimentacao; label: string; emoji: string }[] = [
  { id: "passagem",    label: "Passagem",    emoji: "✈️" },
  { id: "hospedagem",  label: "Hospedagem",  emoji: "🏨" },
  { id: "alimentacao", label: "Alimentação", emoji: "🍽️" },
  { id: "passeios",    label: "Passeios",    emoji: "📸" },
];

function ModalAdicionarCapital({
  onFechar,
  onSalvar,
  meta,
  reservado,
}: {
  onFechar: () => void;
  onSalvar: (mov: Movimentacao) => Promise<void>;
  meta: Record<CategoriaMovimentacao, number>;
  reservado: Record<CategoriaMovimentacao, number>;
}) {
  const [categoria, setCategoria] = useState<CategoriaMovimentacao>("passagem");
  const [tipo, setTipo] = useState<TipoMovimentacao>("entrada");
  const [valorStr, setValorStr] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const valorValido = parseFloat(valorStr) > 0;

  const metaCat = meta[categoria];
  const reservadoCat = reservado[categoria];
  const faltaCat = Math.max(0, metaCat - reservadoCat);
  const progressoCat = metaCat > 0 ? Math.min(100, (reservadoCat / metaCat) * 100) : 0;
  const atingiuMeta = metaCat > 0 && reservadoCat >= metaCat;

  async function handleSalvar() {
    if (!valorValido || salvando) return;

    setErro("");
    setSalvando(true);

    try {
      await onSalvar({
        id: Date.now().toString(),
        categoria,
        tipo,
        valor: parseFloat(valorStr),
        dataCriacao: new Date().toISOString(),
      });
      onFechar();
    } catch {
      setErro("Nao foi possivel salvar a movimentacao.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white px-6 pt-6 pb-8 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Adicionar capital</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoria(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoria === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-2.5">
          <p className="text-xs text-gray-500">
            Você está adicionando capital para{" "}
            <span className="font-semibold text-gray-800">
              {CATEGORIAS.find((c) => c.id === categoria)?.label}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-gray-400">Meta</p>
              <p className="text-xs font-semibold text-gray-900">{moeda(metaCat)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Reservado</p>
              <p className="text-xs font-semibold text-green-600">{moeda(reservadoCat)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Falta</p>
              <p className={`text-xs font-semibold ${atingiuMeta ? "text-green-600" : "text-gray-900"}`}>
                {atingiuMeta ? "—" : moeda(faltaCat)}
              </p>
            </div>
          </div>
          <div>
            <div className="flex items-center mb-1">
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden mr-2">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressoCat}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 shrink-0">{Math.round(progressoCat)}%</span>
            </div>
            <p className={`text-[11px] leading-snug ${atingiuMeta ? "text-green-600 font-medium" : "text-gray-500"}`}>
              {atingiuMeta
                ? "✓ Essa categoria já atingiu a meta."
                : `Faltam ${moeda(faltaCat)} para completar essa categoria.`}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Tipo</p>
          <div className="flex gap-2">
            {(["entrada", "saida"] as TipoMovimentacao[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tipo === t
                    ? t === "entrada" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Valor</p>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400 text-sm">R$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
            />
          </div>
        </div>

        {erro && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!valorValido || salvando}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors ${
              valorValido && !salvando ? "bg-green-500 hover:bg-green-600 cursor-pointer" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal "Meus Destinos" ────────────────────────────────────────────────────

function ModalMeusDestinos({
  viagens,
  viagemAtivaId,
  onFechar,
  onSelecionar,
  onDeslogar,
}: {
  viagens: ViagemItem[];
  viagemAtivaId: string | null;
  onFechar: () => void;
  onSelecionar: (id: string) => Promise<void>;
  onDeslogar: () => Promise<void>;
}) {
  const router = useRouter();
  const [selecionandoId, setSelecionandoId] = useState<string | null>(null);
  const [deslogando, setDeslogando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSelecionarViagem(id: string) {
    setErro("");
    setSelecionandoId(id);

    try {
      await onSelecionar(id);
      onFechar();
    } catch {
      setErro("Nao foi possivel selecionar esse destino.");
    } finally {
      setSelecionandoId(null);
    }
  }

  function handleAdicionarOutroDestino() {
    onFechar();
    router.push("/diagnostico");
  }

  async function handleDeslogar() {
    setErro("");
    setDeslogando(true);

    try {
      await onDeslogar();
      onFechar();
    } catch {
      setErro("Nao foi possivel sair da conta.");
    } finally {
      setDeslogando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white px-6 pt-6 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Meus destinos</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {viagens.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum destino cadastrado ainda.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {viagens.map((viagem) => {
              const ativa = viagem.id === viagemAtivaId;
              const custoTotal = calcularPlanoViagem(viagem.dados).custoTotal;
              return (
                <button
                  key={viagem.id}
                  onClick={() => handleSelecionarViagem(viagem.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    ativa
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-100 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${ativa ? "text-blue-800" : "text-gray-900"}`}>
                        {viagem.dados.destino}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatarDataCompleta(viagem.dados.dataIda)}
                        {viagem.dados.dataVolta ? ` a ${formatarDataCompleta(viagem.dados.dataVolta)}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{moeda(custoTotal)}</p>
                    </div>
                    {ativa && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        Ativa
                      </span>
                    )}
                    {selecionandoId === viagem.id && (
                      <span className="shrink-0 text-[10px] font-semibold text-gray-400">
                        Salvando...
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {erro && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}

        <button
          onClick={handleAdicionarOutroDestino}
          className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          + Adicionar outro destino
        </button>

        <button
          onClick={handleDeslogar}
          disabled={deslogando}
          className="mt-3 w-full rounded-xl border border-red-100 bg-red-50 py-3 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {deslogando ? "Saindo..." : "Deslogar"}
        </button>
      </div>
    </div>
  );
}

// ─── Navegação inferior com popover ──────────────────────────────────────────

function NavInferior({
  onAdicionarCapital,
  onMeusDestinos,
}: {
  onAdicionarCapital: () => void;
  onMeusDestinos: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative border-t border-gray-100">
      {aberto && <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />}

      {aberto && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-20 mb-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <button
            onClick={() => { setAberto(false); onAdicionarCapital(); }}
            className="w-full px-4 py-3.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Adicionar capital
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-8 py-4">
        <button
          onClick={() => alert("Em breve")}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span className="text-xl">✈️</span>
          <span className="text-[11px]">Passagens</span>
        </button>

        <button
          onClick={() => setAberto(!aberto)}
          className={`w-12 h-12 rounded-full bg-green-500 text-white text-2xl font-medium flex items-center justify-center shadow-md hover:bg-green-600 transition-all duration-200 ${aberto ? "rotate-45" : ""}`}
        >
          +
        </button>

        <button
          onClick={onMeusDestinos}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span className="text-xl">🗺️</span>
          <span className="text-[11px]">Meus destinos</span>
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MinhaViagem() {
  const router = useRouter();
  const [store, setStore] = useState<ViagemStore>(STORE_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modalCapitalAberto, setModalCapitalAberto] = useState(false);
  const [modalDestinosAberto, setModalDestinosAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setErro("");

      try {
        const storeCarregado = await carregarViagemStore();
        if (!cancelado) setStore(storeCarregado);
      } catch {
        if (!cancelado) setErro("Nao foi possivel carregar suas viagens.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, []);

  async function handleAdicionarMovimentacao(mov: Movimentacao) {
    const storeAtualizado = await adicionarMovimentacaoRepository(mov);
    setStore(storeAtualizado);
  }

  async function handleSelecionarViagem(id: string) {
    const storeAtualizado = await definirViagemAtivaRepository(id);
    setStore(storeAtualizado);
  }

  async function handleDeslogar() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    const storeAtualizado = await carregarViagemStore();
    setStore(storeAtualizado);
    router.replace("/login");
  }

  const viagemAtiva = store.viagens.find((v) => v.id === store.viagemAtivaId) ?? null;

  if (carregando) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 px-5 py-12 text-center">
          <p className="text-sm text-gray-400">Carregando sua viagem...</p>
        </div>
      </div>
    );
  }

  // Estado vazio
  if (!viagemAtiva) {
    return (
      <>
        {modalDestinosAberto && (
          <ModalMeusDestinos
            viagens={store.viagens}
            viagemAtivaId={store.viagemAtivaId}
            onFechar={() => setModalDestinosAberto(false)}
            onSelecionar={handleSelecionarViagem}
            onDeslogar={handleDeslogar}
          />
        )}
        <div className="flex flex-col">
          <div className="flex-1 px-5 py-12 text-center space-y-5">
            {erro && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                {erro}
              </p>
            )}
            <p className="text-sm text-gray-400">Nenhuma viagem planejada ainda.</p>
            <Link
              href="/diagnostico"
              className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Planejar minha viagem
            </Link>
          </div>
          <NavInferior
            onAdicionarCapital={() => {}}
            onMeusDestinos={() => setModalDestinosAberto(true)}
          />
        </div>
      </>
    );
  }

  const { dados, movimentacoes } = viagemAtiva;
  const plano = calcularPlanoViagem(dados);

  const meta = {
    passagem:    dados.valorPassagem,
    hospedagem:  dados.valorHospedagem,
    alimentacao: dados.valorAlimentacao,
    passeios:    dados.valorPasseios,
  };

  const reservado = {
    passagem:    calcularReservado(movimentacoes, "passagem"),
    hospedagem:  calcularReservado(movimentacoes, "hospedagem"),
    alimentacao: calcularReservado(movimentacoes, "alimentacao"),
    passeios:    calcularReservado(movimentacoes, "passeios"),
  };

  const totalReservado = Object.values(reservado).reduce((a, b) => a + b, 0);
  const restante = Math.max(0, plano.custoTotal - totalReservado);
  const percentualReservado =
    plano.custoTotal > 0 ? (totalReservado / plano.custoTotal) * 100 : 0;

  const tempoFaltando =
    plano.diasAteViagem < 30
      ? `${plano.diasAteViagem} ${plano.diasAteViagem === 1 ? "dia" : "dias"}`
      : `${plano.mesesAteViagem} ${plano.mesesAteViagem === 1 ? "mês" : "meses"}`;

  const categorias = [
    { emoji: "✈️", nome: "Passagens",   meta: meta.passagem,    reservado: reservado.passagem,    cor: "bg-blue-500"   },
    { emoji: "🏨", nome: "Hospedagem",  meta: meta.hospedagem,  reservado: reservado.hospedagem,  cor: "bg-purple-500" },
    { emoji: "🍽️", nome: "Alimentação", meta: meta.alimentacao, reservado: reservado.alimentacao, cor: "bg-orange-500" },
    { emoji: "📸", nome: "Passeios",    meta: meta.passeios,    reservado: reservado.passeios,    cor: "bg-amber-500"  },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-hidden">

      {modalCapitalAberto && (
        <ModalAdicionarCapital
          onFechar={() => setModalCapitalAberto(false)}
          onSalvar={handleAdicionarMovimentacao}
          meta={meta}
          reservado={reservado}
        />
      )}

      {modalDestinosAberto && (
        <ModalMeusDestinos
          viagens={store.viagens}
          viagemAtivaId={store.viagemAtivaId}
          onFechar={() => setModalDestinosAberto(false)}
          onSelecionar={handleSelecionarViagem}
          onDeslogar={handleDeslogar}
        />
      )}

      {/* Conteúdo rolável */}
      <div className="min-w-0 px-5 pt-6 pb-4 space-y-4">
        {erro && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
            {erro}
          </p>
        )}

        {/* 1 — Header */}
        <div className="flex min-w-0 items-start justify-between gap-3 overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl shrink-0">✈️</div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Olá, Viajante! ✈️</h1>
              <p className="text-xs text-gray-500 leading-snug mt-0.5">
                Pronto para mais<br />uma grande viagem?
              </p>
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 shrink-0" />
        </div>

        {/* 2 — Próxima viagem */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Próxima viagem</p>
              <p className="text-xl font-bold text-gray-900 mt-1 truncate">{dados.destino}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatarData(dados.dataIda)}
                {dados.dataVolta ? ` a ${formatarData(dados.dataVolta)}` : ""}
              </p>
              <Link
                href="/diagnostico?editar=1"
                className="inline-block mt-2.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-full transition-colors"
              >
                Editar info
              </Link>
            </div>
            <div className="w-px bg-gray-100 self-stretch shrink-0" />
            <div className="text-right shrink-0 pl-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Faltam</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{tempoFaltando}</p>
            </div>
          </div>
        </div>

        {/* 3 — Resumo do orçamento */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Resumo do orçamento</p>
            <Link href="/diagnostico?editar=1" className="text-xs text-blue-500 hover:text-blue-600">Editar</Link>
          </div>

          <div className="grid min-w-0 grid-cols-3 gap-2 mb-4">
            <div>
              <p className="text-[10px] text-gray-400 leading-tight">Orçamento total</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{moeda(plano.custoTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-tight">Reservado</p>
              <p className="text-sm font-bold text-green-600 mt-0.5">{moeda(totalReservado)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-tight">Restante</p>
              <p className={`text-sm font-bold mt-0.5 ${restante === 0 ? "text-green-500" : "text-gray-900"}`}>
                {restante === 0 ? "✓ Meta!" : moeda(restante)}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <AnelProgresso percentual={percentualReservado} consegue={plano.consegueViajarNaData} />
            <div className="space-y-2.5 flex-1 min-w-0">
              <LegendaItem cor="bg-blue-500"  label="Orçamento total" valor={moeda(plano.custoTotal)} />
              <LegendaItem cor="bg-green-500" label="Reservado"        valor={moeda(totalReservado)} />
              <LegendaItem cor="bg-gray-200"  label="Restante"         valor={moeda(restante)} />
            </div>
          </div>
        </div>

        {/* 4 — Custos por categoria */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Custos por categoria</p>
          <div className="flex max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-1">
            {categorias.map((cat) => (
              <CardCategoria key={cat.nome} {...cat} />
            ))}
          </div>
        </div>

      </div>

      {/* 5 — Navegação inferior */}
      <NavInferior
        onAdicionarCapital={() => setModalCapitalAberto(true)}
        onMeusDestinos={() => setModalDestinosAberto(true)}
      />

    </div>
  );
}
